/*  FrankBonjour.m -- the phone looks for its Mac through APPLE'S Bonjour, not a socket of its own.
    ---------------------------------------------------------------------
    P3, 14 October 2026. Osca: "this whole, over wifi thing DOESN'T WORK on my actual phone ... the network stuff
    works very differently on my phone to on the simulator."

    WHY. `sync_discover` browsed with `mdns-sd`, a pure-Rust mDNS stack that opens ITS OWN UDP multicast socket on
    224.0.0.251:5353. On a real iPhone (iOS 14+) a raw multicast socket needs the restricted
    `com.apple.developer.networking.multicast` entitlement, which a free personal team cannot carry -- so on the
    phone the browse saw nothing, every time. The Simulator is a Mac process on the Mac's own network stack: no
    entitlement, no Local Network prompt, multicast just works -- which is why it worked there and nowhere else.
    (ENTITLEMENT.md, 14 Sep, wrote this down as "road B" and left it unbuilt.)

    WHAT THIS IS. NSNetServiceBrowser + NSNetService resolve -- Foundation's Bonjour, which asks the system's
    mDNSResponder instead of opening a socket. Browsing a type DECLARED in NSBonjourServices through Apple's API
    needs only the Local Network permission (the prompt, NSLocalNetworkUsageDescription), not the entitlement.
    NSNetService is deprecated since iOS 16 in favour of NWBrowser and still works; it is chosen because it is in
    Foundation, which every archive here already links -- Network.framework would be a new `sdk:` line in
    project.yml and the link-time trap job 8b wrote down if the Xcode project is not regenerated.

    THE CALL. One C function, blocking for `seconds`, run on a private thread with its own run loop (a
    NSNetServiceBrowser needs a run loop; the caller is Rust on whatever thread Tauri gives a command, which must
    not be spun). It writes JSON into the caller's buffer:
        {"rows":[{"name":"Air Studio","host":"192.168.1.5","port":41499}], "error": null | "<sentence>"}
    and returns the byte count, or -1 if the buffer was too small. `error` is set when the system REFUSED the
    browse (the Local Network permission declined: NSNetServicesErrorCode -72008 / kDNSServiceErr_PolicyDenied),
    which the card prints instead of "no Mac found".

    Compiled by build.rs into its own archive (`frankbonjour`), the house pattern; absent from the Xcode target's
    sources. UNBUILT when written (P3 lane, from the Cowork container: no Xcode) -- the first phone build is its
    first compile.
*/
#import <Foundation/Foundation.h>
#include <dispatch/dispatch.h>
#include <arpa/inet.h>
#include <netinet/in.h>
#include <string.h>

#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"

@interface FrankBonjourRun : NSObject <NSNetServiceBrowserDelegate, NSNetServiceDelegate>
@property (nonatomic, strong) NSMutableArray<NSNetServiceBrowser *> *browsers;
@property (nonatomic, strong) NSMutableArray<NSNetService *> *services;
@property (nonatomic, strong) NSMutableDictionary<NSString *, NSDictionary *> *rows;   // by name, first type wins
@property (nonatomic, copy) NSString *error;
@property (nonatomic, assign) double seconds;
@property (nonatomic, strong) NSArray<NSString *> *types;
@end

@implementation FrankBonjourRun

- (void)runOnThisThread {
    self.browsers = [NSMutableArray array];
    self.services = [NSMutableArray array];
    self.rows = [NSMutableDictionary dictionary];
    NSRunLoop *loop = [NSRunLoop currentRunLoop];
    for (NSString *type in self.types) {
        NSNetServiceBrowser *b = [[NSNetServiceBrowser alloc] init];
        b.delegate = self;
        [b scheduleInRunLoop:loop forMode:NSDefaultRunLoopMode];
        [b searchForServicesOfType:type inDomain:@"local."];
        [self.browsers addObject:b];
    }
    NSDate *end = [NSDate dateWithTimeIntervalSinceNow:self.seconds];
    while ([end timeIntervalSinceNow] > 0) {
        @autoreleasepool {
            [loop runMode:NSDefaultRunLoopMode beforeDate:[NSDate dateWithTimeIntervalSinceNow:0.1]];
        }
    }
    for (NSNetServiceBrowser *b in self.browsers) { [b stop]; b.delegate = nil; }
    for (NSNetService *s in self.services) { [s stop]; s.delegate = nil; }
}

- (void)netServiceBrowser:(NSNetServiceBrowser *)browser didFindService:(NSNetService *)service moreComing:(BOOL)more {
    [self.services addObject:service];
    service.delegate = self;
    [service scheduleInRunLoop:[NSRunLoop currentRunLoop] forMode:NSDefaultRunLoopMode];
    [service resolveWithTimeout:self.seconds];
}

- (void)netServiceBrowser:(NSNetServiceBrowser *)browser didNotSearch:(NSDictionary<NSString *, NSNumber *> *)err {
    NSNumber *code = err[NSNetServicesErrorCode];
    self.error = [NSString stringWithFormat:
        @"Frank is not allowed to look on this Wi-Fi (Bonjour error %@). On the iPhone: Settings > Privacy & Security > Local Network > Frank, on. Or type the address and code your Mac shows.",
        code ?: @"?"];
}

- (void)netServiceDidResolveAddress:(NSNetService *)service {
    NSString *v4 = nil, *v6 = nil;
    for (NSData *d in service.addresses) {
        const struct sockaddr *sa = (const struct sockaddr *)d.bytes;
        char buf[INET6_ADDRSTRLEN] = {0};
        if (sa->sa_family == AF_INET && d.length >= sizeof(struct sockaddr_in) && !v4) {
            const struct sockaddr_in *in4 = (const struct sockaddr_in *)sa;
            if (inet_ntop(AF_INET, &in4->sin_addr, buf, sizeof buf)) v4 = [NSString stringWithUTF8String:buf];
        } else if (sa->sa_family == AF_INET6 && d.length >= sizeof(struct sockaddr_in6) && !v6) {
            const struct sockaddr_in6 *in6 = (const struct sockaddr_in6 *)sa;
            if (inet_ntop(AF_INET6, &in6->sin6_addr, buf, sizeof buf)) v6 = [NSString stringWithFormat:@"[%s]", buf];
        }
    }
    NSString *host = v4 ?: v6;
    if (!host || service.port <= 0) return;
    NSString *name = service.name ?: @"";
    NSData *txt = service.TXTRecordData;
    if (txt) {
        NSData *n = [NSNetService dictionaryFromTXTRecordData:txt][@"name"];
        NSString *s = n ? [[NSString alloc] initWithData:n encoding:NSUTF8StringEncoding] : nil;
        if (s.length) name = s;
    }
    if (self.rows[name]) return;            // one Mac answers to both types: one row, the first type's
    self.rows[name] = @{ @"name": name, @"host": host, @"port": @(service.port) };
}

- (void)netService:(NSNetService *)service didNotResolve:(NSDictionary<NSString *, NSNumber *> *)err {
    /* a service that will not resolve is skipped; the others still answer */
}

@end

#pragma clang diagnostic pop

/* `types` are Bonjour types without the domain ("_frank._tcp."), in preference order. */
int frank_bonjour_browse(const char *const *types, int ntypes, double seconds, char *out, int cap) {
    @autoreleasepool {
        FrankBonjourRun *run = [[FrankBonjourRun alloc] init];
        NSMutableArray *ts = [NSMutableArray array];
        for (int i = 0; i < ntypes; i++) if (types[i]) [ts addObject:[NSString stringWithUTF8String:types[i]]];
        run.types = ts;
        run.seconds = seconds;
        dispatch_semaphore_t done = dispatch_semaphore_create(0);
        NSThread *t = [[NSThread alloc] initWithBlock:^{
            [run runOnThisThread];
            dispatch_semaphore_signal(done);
        }];
        t.name = @"frank-bonjour";
        [t start];
        dispatch_semaphore_wait(done, dispatch_time(DISPATCH_TIME_NOW, (int64_t)((seconds + 2.0) * NSEC_PER_SEC)));
        NSMutableArray *rows = [NSMutableArray array];
        [rows addObjectsFromArray:run.rows.allValues];
        NSDictionary *res = @{ @"rows": rows, @"error": run.error ?: [NSNull null] };
        NSData *json = [NSJSONSerialization dataWithJSONObject:res options:0 error:nil];
        if (!json || (int)json.length + 1 > cap) return -1;
        memcpy(out, json.bytes, json.length);
        out[json.length] = 0;
        return (int)json.length;
    }
}

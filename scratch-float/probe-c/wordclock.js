/* wordclock.js -- which word is under the audio clock.
   The one piece all three float roads share, and the one piece that can be
   proved without a phone: time in seconds -> word index. No rAF, no timer, no
   DOM. A float painted while the app is in the BACKGROUND cannot lean on
   requestAnimationFrame, so the cursor is a pure function of the audio clock.
   Plain script: a page gets `WordClock`; the node harness evals this file. */
var WordClock = (function () {
  function make(timeline) {
    var t = timeline.map(function (x) { return x.t; });
    function indexAt(s) {                       /* last word whose start <= s */
      var lo = 0, hi = t.length - 1, ans = -1;
      while (lo <= hi) {
        var mid = (lo + hi) >> 1;
        if (t[mid] <= s) { ans = mid; lo = mid + 1; } else hi = mid - 1;
      }
      return ans;
    }
    return {
      length: timeline.length,
      indexAt: indexAt,
      wordAt: function (s) { var i = indexAt(s); return i < 0 ? "" : timeline[i].w; },
      sample: function (step, from, to) {       /* what a sampler at 1/step Hz would show */
        var out = [], last = -2, n = Math.floor((to - from) / step + 1e-9);
        for (var k = 0; k <= n; k++) {          /* k*step, never accumulated: 5490 */
          var i = indexAt(from + k * step);     /* additions drift past the last word */
          if (i !== last) { out.push(i); last = i; }
        }
        var end = indexAt(to);                  /* `to` itself, which k*step */
        if (end !== last) out.push(end);        /* lands just short of */
        return out;
      }
    };
  }
  return { make: make };
})();

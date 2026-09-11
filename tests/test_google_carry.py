"""The iOS client id is CARRIED by every import, never pasted (Osca, 11 Sep:
"should always push/export these things to the IOS app"). `import_shell.
carry_google` reads it out of TTSTV's account.json and writes the three
places `test_google_link.py` holds together. Here: it repairs a blank id and
a stale scheme, leaves a correct repo byte-identical, and says so."""
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO / "tools"))
import import_shell as m  # noqa: E402

CID = "12345-abc.apps.googleusercontent.com"
SCHEME = "com.googleusercontent.apps.12345-abc"


def _point(m, tmp):
    (tmp / "src-tauri" / "gen" / "apple").mkdir(parents=True)
    m.GOOGLE_JSON = tmp / "src-tauri" / "google.json"
    m.TAURI_CONF = tmp / "src-tauri" / "tauri.conf.json"
    m.PROJECT_YML = tmp / "src-tauri" / "gen" / "apple" / "project.yml"


def _seed(m, scheme_list, yml_scheme):
    m.GOOGLE_JSON.write_text('{\n  "ios_client_id": ""\n}\n')
    conf = json.loads((REPO / "src-tauri" / "tauri.conf.json").read_text())
    conf["plugins"]["deep-link"]["mobile"][0]["scheme"] = scheme_list
    m.TAURI_CONF.write_text(json.dumps(conf, indent=2) + "\n")
    yml = m.YML_ANCHOR + ((m.YML_BLOCK_HEAD + "              - " + yml_scheme + "\n") if yml_scheme else "")
    m.PROJECT_YML.write_text("name: frank\n" + yml + "        CFBundleVersion: x\n")


def test_repairs_blank_id_and_stale_scheme_then_is_idempotent(tmp_path, monkeypatch):
    _point(m, tmp_path)
    monkeypatch.setattr(m, "_ios_client_id", lambda root: (CID, "fake account.json"))
    for stale in (None, "com.googleusercontent.apps.OLD"):
        _seed(m, ["frank-pair"] + ([stale] if stale else []), stale)
        line = m.carry_google(REPO)
        assert line.endswith("google.json, tauri.conf.json, project.yml"), line
        assert json.loads(m.GOOGLE_JSON.read_text()) == {"ios_client_id": CID}
        assert json.loads(m.TAURI_CONF.read_text())["plugins"]["deep-link"]["mobile"][0]["scheme"] == ["frank-pair", SCHEME]
        yml = m.PROJECT_YML.read_text()
        assert yml.count("google-oauth") == 1 and SCHEME in yml and "apps.OLD" not in yml
        assert "frank-pair" in yml, "the pairing scheme is untouched"
        again = m.carry_google(REPO)
        assert again.endswith("already in place"), again


def test_no_id_changes_nothing_and_says_where_it_looked(tmp_path, monkeypatch):
    _point(m, tmp_path)
    _seed(m, ["frank-pair"], None)
    before = {p: p.read_text() for p in (m.GOOGLE_JSON, m.TAURI_CONF, m.PROJECT_YML)}
    monkeypatch.setattr(m, "_ios_client_id", lambda root: ("", "no google.ios_client_id in /x/account.json"))
    line = m.carry_google(REPO)
    assert line == "google: not carried -- no google.ios_client_id in /x/account.json"
    assert all(p.read_text() == before[p] for p in before)


def test_the_real_repo_is_already_what_a_carry_would_write():
    """The hand paste of 11 Sep (668142a) and the carry must agree, or the
    next import rewrites the three files behind the commit."""
    cid = json.loads((REPO / "src-tauri" / "google.json").read_text())["ios_client_id"]
    if not cid:
        return
    import shutil, tempfile
    tmp = Path(tempfile.mkdtemp())
    try:
        for rel in ("src-tauri/google.json", "src-tauri/tauri.conf.json", "src-tauri/gen/apple/project.yml"):
            (tmp / rel).parent.mkdir(parents=True, exist_ok=True)
            shutil.copy(REPO / rel, tmp / rel)
        saved = (m.GOOGLE_JSON, m.TAURI_CONF, m.PROJECT_YML)
        m.GOOGLE_JSON, m.TAURI_CONF, m.PROJECT_YML = (tmp / "src-tauri/google.json", tmp / "src-tauri/tauri.conf.json", tmp / "src-tauri/gen/apple/project.yml")
        real = m._ios_client_id
        m._ios_client_id = lambda root: (cid, "google.json itself")
        try:
            assert m.carry_google(REPO).endswith("already in place")
        finally:
            m.GOOGLE_JSON, m.TAURI_CONF, m.PROJECT_YML = saved
            m._ios_client_id = real
    finally:
        shutil.rmtree(tmp)

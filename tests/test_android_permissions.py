"""`RECORD_AUDIO` goes in once, goes in the right place, and goes in again never.

`tools/android_permissions.py` patches a file that does not exist in this repo
(`gen/android/` is written by `tauri android init`), so the test drives the
pure function over a manifest of the shape `init` writes rather than over a
committed fixture.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO / "tools"))
from android_permissions import PERMISSION, patch  # noqa: E402

GENERATED = """<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET" />
    <application
        android:label="Frank"
        android:usesCleartextTraffic="true">
        <activity android:name=".MainActivity" />
    </application>
</manifest>
"""


def test_the_permission_is_added_before_the_application_element():
    out, changed = patch(GENERATED)
    assert changed
    assert PERMISSION in out
    # The schema wants uses-permission before <application>, and so does every
    # build tool that reads it.
    assert out.index(PERMISSION) < out.index("<application")


def test_running_it_twice_changes_nothing():
    once, _ = patch(GENERATED)
    twice, changed = patch(once)
    assert not changed
    assert twice == once
    assert once.count(PERMISSION) == 1


def test_a_manifest_that_already_has_it_is_left_alone():
    already = GENERATED.replace(
        '<uses-permission android:name="android.permission.INTERNET" />',
        f'<uses-permission android:name="{PERMISSION}" />',
    )
    out, changed = patch(already)
    assert not changed and out == already


def test_a_file_that_is_not_a_manifest_is_refused_rather_than_mangled():
    with pytest.raises(SystemExit):
        patch("<html><body>not a manifest</body></html>")

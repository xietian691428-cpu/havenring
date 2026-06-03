#!/usr/bin/env python3
"""
Derive NTAG 424 DNA application keys from Haven MASTER_KEY + tag UID.
Algorithm matches icedevml/sdm-backend legacy_derive.py (NFC Developer App compatible).

Usage:
  python3 scripts/derive-ntag424-keys.py a53082d97e19a11329ef2e3f7e0d092c 0453A53A502390
  python3 scripts/derive-ntag424-keys.py a53082d97e19a11329ef2e3f7e0d092c 04:53:A5:3A:50:23:90
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from ntag424_key_derive import (  # noqa: E402
    derive_all_keys,
    derive_tag_key,
    derive_undiversified_key,
    format_uid,
    normalize_uid,
)


def main() -> None:
    if len(sys.argv) != 3:
        print(__doc__.strip())
        sys.exit(1)

    master_hex = sys.argv[1].strip().lower()
    uid = normalize_uid(sys.argv[2])

    if len(master_hex) != 32:
        raise SystemExit("MASTER_KEY must be 32 hex characters (16 bytes).")

    master_key = bytes.fromhex(master_hex)

    print("Haven NTAG 424 DNA — per-tag keys (for TagXplorer Change Key)")
    print("=" * 60)
    print(f"UID:         {uid.hex().upper()} ({len(uid)} bytes)")
    print(f"MASTER_KEY:  {master_hex}")
    print("-" * 60)
    print("Slot | Role (Haven)              | Key (32 hex, paste into TagXplorer)")
    print("-" * 60)

    roles = {
        0: "Application Master Key",
        1: "SDM Meta Read (picc_data)",
        2: "SDM File Read (cmac)",
        3: "File access",
        4: "Counter retrieval",
    }

    keys = derive_all_keys(master_key, uid)
    for key_no in range(5):
        print(f"  {key_no}  | {roles[key_no]:<26} | {keys[key_no]}")

    print("-" * 60)
    print("SDM settings: Meta Read = Key 1, File Read = Key 2")
    print("Change Key1–Key4 first, then Key0 last (TagXplorer).")


if __name__ == "__main__":
    main()

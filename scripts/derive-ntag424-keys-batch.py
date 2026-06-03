#!/usr/bin/env python3
"""
Batch derive NTAG 424 keys for factory TagXplorer Change Key.

Usage:
  export MASTER_KEY=a53082d97e19a11329ef2e3f7e0d092c
  python3 scripts/derive-ntag424-keys-batch.py uids.txt
  python3 scripts/derive-ntag424-keys-batch.py 04:42:45:3A:50:23:80 04:53:A5:3A:50:23:90

  python3 scripts/derive-ntag424-keys-batch.py --master a53082d9... uids.txt -o factory-keys.csv

uids.txt: one UID per line (# comments and blank lines ignored).
"""

from __future__ import annotations

import argparse
import csv
import os
import sys
from pathlib import Path

# Allow import when run as script from repo root
sys.path.insert(0, str(Path(__file__).resolve().parent))
from ntag424_key_derive import derive_all_keys, format_uid, normalize_uid  # noqa: E402


def load_uids(paths: list[str], inline: list[str]) -> list[bytes]:
    uids: list[bytes] = []
    for raw in inline:
        uids.append(normalize_uid(raw))
    for path in paths:
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                # CSV: take first column if comma-separated
                token = line.split(",")[0].strip()
                uids.append(normalize_uid(token))
    if not uids:
        raise SystemExit("No UIDs provided.")
    return uids


def main() -> None:
    parser = argparse.ArgumentParser(description="Batch NTAG 424 key table for factory")
    parser.add_argument(
        "uids",
        nargs="*",
        help="UID(s) or path to uid list file (.txt / .csv first column)",
    )
    parser.add_argument(
        "--master",
        default=os.environ.get("MASTER_KEY", ""),
        help="32-char hex MASTER_KEY (or set env MASTER_KEY)",
    )
    parser.add_argument(
        "-o",
        "--output",
        default="factory-keys.csv",
        help="Output CSV path (default: factory-keys.csv)",
    )
    args = parser.parse_args()

    master_hex = args.master.strip().lower()
    if len(master_hex) != 32:
        raise SystemExit("MASTER_KEY must be 32 hex characters. Use --master or export MASTER_KEY.")

    master_key = bytes.fromhex(master_hex)

    inline: list[str] = []
    files: list[str] = []
    for item in args.uids:
        p = Path(item)
        if p.is_file():
            files.append(str(p))
        else:
            inline.append(item)

    uid_list = load_uids(files, inline)
    key1_global = derive_all_keys(master_key, uid_list[0])[1]

    rows: list[dict[str, str]] = []
    for i, uid in enumerate(uid_list, start=1):
        keys = derive_all_keys(master_key, uid)
        rows.append(
            {
                "序号_No": str(i),
                "UID": format_uid(uid),
                "UID_hex": uid.hex().upper(),
                "Key0_Master": keys[0],
                "Key1_MetaRead_picc": keys[1],
                "Key2_FileRead_cmac": keys[2],
                "Key3_FileAccess": keys[3],
                "Key4_Counter": keys[4],
            }
        )

    fieldnames = list(rows[0].keys())
    with open(args.output, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows)

    print(f"Wrote {len(rows)} ring(s) → {args.output}")
    print(f"Key1 (SDM Meta Read) is the same for all rings: {key1_global}")
    print("Factory: Change Key 01→02→03→04→00 in TagXplorer (Old Key = all zeros if phase-1 only).")


if __name__ == "__main__":
    main()

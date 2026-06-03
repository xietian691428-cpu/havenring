"""Shared NTAG 424 key derivation (icedevml/sdm-backend legacy mode)."""

from __future__ import annotations

import hashlib


def normalize_uid(raw: str) -> bytes:
    hex_str = raw.replace(":", "").replace("-", "").replace(" ", "").strip().upper()
    if not hex_str or len(hex_str) % 2 != 0:
        raise ValueError(f"Invalid UID: {raw!r}")
    return bytes.fromhex(hex_str)


def format_uid(uid: bytes) -> str:
    return ":".join(f"{b:02X}" for b in uid)


def derive_tag_key(master_key: bytes, uid: bytes, key_no: int) -> bytes:
    if master_key == b"\x00" * 16:
        return b"\x00" * 16
    return hashlib.pbkdf2_hmac("sha512", master_key, b"key" + uid + bytes([key_no]), 5000, 16)


def derive_undiversified_key(master_key: bytes, key_no: int) -> bytes:
    if master_key == b"\x00" * 16:
        return b"\x00" * 16
    return hashlib.pbkdf2_hmac("sha512", master_key, b"key_no_uid" + bytes([key_no]), 5000, 16)


def derive_all_keys(master_key: bytes, uid: bytes) -> dict[int, str]:
    out: dict[int, str] = {}
    for key_no in range(5):
        if key_no == 1:
            key = derive_undiversified_key(master_key, key_no)
        else:
            key = derive_tag_key(master_key, uid, key_no)
        out[key_no] = key.hex().upper()
    return out

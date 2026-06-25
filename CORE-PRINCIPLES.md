# Haven — Core Principles (living document)

> **Highest-priority product memory for all agents and contributors.**  
> **Date locked:** June 2026  
> **Project:** Haven — personal private Memory Sanctuary

This file **supersedes** older assumptions about real-time cloud sync, implicit pair vault sharing, and server-dependent Seal success. When this document conflicts with `docs/core-definition.md`, **this file wins** until `core-definition.md` is explicitly reconciled.

**Also read:** `docs/core-definition.md`, `docs/architecture-decisions.md`, `AGENTS.md`

---

## Changelog

| Date | Update |
|------|--------|
| 2026-06-17 | **Local-first source of truth**; cloud = optional async backup + explicit share only; Seal must succeed locally without network wait. Replaces real-time sync as product default. |
| 2026-06-17 | **Phase 1 Seal:** `persistSealedDraftsLocallyFirst` → immediate success; `commitServerSealFinalize` async via `offlineSyncQueue`. |
| 2026-06-17 | **Phase 1.1:** `persistSealLocalRelay` before staging upload; offline `collectDraftPayloadsForSeal`; Settings background backup status line. |
| 2026-06-17 | **Post-Seal memory guard:** aggressive thumbs, large-photo defer, 200MB local relay/persist caps, quota warning. |

---

## 1. Core flow principles (consensus — do not modify without explicit approval)

### Local-first — source of truth

- **Local is always the source of truth.** All core user actions must complete **100% on device**: write → NFC Seal → store → view → comment (supplements).
- **Seal must succeed locally immediately.** The moment the user finishes the ring tap, they get deterministic feedback (“sealed”) — **no network wait** and **no server dependency** on the success path.
- **IndexedDB + sidecar dual-write** must remain maximally reliable. **Supplements (comments) must never be lost** (`mergeSupplements`, sidecar persistence).

### NFC ritual is core UX

- The ring is for **local Seal ritual + bind only** — never login or daily unlock.
- Seal stays **foolproof, low-friction, minimal feedback**. Any change that adds ritual friction is rejected unless explicitly approved.

### Cloud (Plus) — new positioning

- Cloud is an **optional asynchronous backup and selective sharing tool** — **not** a real-time sync system.
- **Default:** all memories live **only on device** until the user opts in.
- User may **actively choose** one or many **already sealed** memories to:
  - **Back up to cloud** (async background job)
  - **Share with a partner or another account** (async; encrypted copy on recipient device)
- Sharing and backup use **incremental + background + retry**. The server may process slowly.
- **Cloud failure or delay must not block local use.** The user always has the full local version.

### Accounts and sharing

- **Strongly prefer one person, one OAuth account** (Apple / Google / Email).
- Partner sharing uses **Plus explicit Shared memories** (recipient gets a local encrypted copy) — **not** a shared login or implicit full-vault read.

---

## 2. Development red lines (do not do)

| Do not | Why |
|--------|-----|
| Make write / Seal / Timeline viewing **depend on live cloud sync** | Local is truth; network is best-effort |
| Add **network requests or server waits** on the Seal **success** path | Ritual must feel instant and certain |
| Treat cloud as **primary storage** or **real-time collaboration** | Plus is backup + explicit share only |
| Weaken **local encryption, E2E, `mergeSupplements`, or sidecar dual-write** | Data integrity and supplements are non-negotiable |
| Extend **legacy implicit pair auto-sync** as the primary sharing story | Explicit Shared + per-memory choice is the target |

**Legacy code** (`haven_members`, pair bundle import, background `runSync`, etc.) may exist until migrated — **do not deepen** real-time-sync UX or blocking gates on top of it.

---

## 3. Copy and user communication

- **Minimal:** only necessary in-flow prompts (≤ **1 sentence** per screen).
- **Clear default:** “Your memories are sealed on this device by default. You can choose to back up or share when you want.”
- **Settings / Help** explain local-first + async cloud backup so users trust the device-first model.

---

## 4. Priority order (every new feature)

1. **Local stability and Seal ritual** (highest)
2. **Supplements never lost**
3. **Async cloud backup and selective sharing**
4. **Cross-device experience** (only within local-first constraints)

---

## 5. Agent guardrail (quick check)

Before shipping, ask:

1. Does Seal **wait on the network** to show success? → **Reject**
2. Does Timeline **require** cloud sync to show local memories? → **Reject**
3. Does sharing happen **without explicit user choice** per memory? → **Reject** (except legacy code being removed)
4. Could supplements be **dropped** on merge or sync? → **Reject**
5. Does in-flow copy exceed one sentence without living in Help? → **Revise**

If a suggestion conflicts with this file, **stop and remind the user** of these principles before implementing.

---

## Appendix — 中文摘要（2026-06 共识）

- **本地永远是真理之源**：写 → Seal → 存 → 看 → 评论，全部以本地为准；Seal 贴戒即成功，不等待网络。
- **戒指只做 Seal 仪式**，不用于登录/解锁；体验保持极简、低摩擦。
- **云端（Plus）= 可选异步备份 + 主动选择分享**，不是实时同步；失败不影响本地完整使用。
- **每人独立账号**；伴侣共享走显式 Shared 记忆（对方本地收副本）。
- **开发禁区**：核心流程不依赖实时云同步；Seal 成功路径不加网络等待；不把云当主存储或协作工具。
- **优先级**：本地稳定与仪式感 → 评论不丢 → 异步云备份/选择性共享 → 跨设备（在本地优先前提下）。

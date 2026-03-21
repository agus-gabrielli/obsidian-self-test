---
phase: 7
slug: provider-settings-and-migration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 7 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x |
| **Config file** | `jest.config.js` or "none - Wave 0 installs" |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test -- --coverage` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test -- --coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | PROV-01 | unit | `npm test` | ❌ W0 | ⬜ pending |
| 07-01-02 | 01 | 1 | PROV-02 | unit | `npm test` | ❌ W0 | ⬜ pending |
| 07-01-03 | 01 | 1 | PROV-03 | unit | `npm test` | ❌ W0 | ⬜ pending |
| 07-01-04 | 01 | 1 | PROV-07 | unit | `npm test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Test stubs for provider settings CRUD (PROV-01, PROV-02)
- [ ] Test stubs for migration logic (PROV-07)
- [ ] Test stubs for curated model lists (PROV-03)

*Existing infrastructure covers framework setup if jest is already configured.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Settings UI re-renders on provider switch | PROV-01 | Obsidian DOM rendering | Open settings, switch provider dropdown, verify fields update |
| API key masking with password field | PROV-02 | Visual verification | Enter API key, verify dots shown |
| v1.0 upgrade migration | PROV-07 | Requires actual data.json with flat keys | Create data.json with flat apiKey, load plugin, verify nested structure |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

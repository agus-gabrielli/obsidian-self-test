---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-09
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None - Phase 1 success criteria are build-time and manual runtime checks |
| **Config file** | none - no test framework needed for this phase |
| **Quick run command** | `npx tsc --noEmit --skipLibCheck` |
| **Full suite command** | `npm run build` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit --skipLibCheck`
- **After every plan wave:** Run `npm run build`
- **Before `/gsd:verify-work`:** Full suite must be green + manual Obsidian load check
- **Max feedback latency:** ~5 seconds (TypeScript check)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 0 | DIST-01 | build | `npm install` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 0 | DIST-01 | build | create `.hotreload` | ❌ W0 | ⬜ pending |
| 1-01-03 | 01 | 1 | DIST-01 | type-check | `npx tsc --noEmit --skipLibCheck` | ✅ | ⬜ pending |
| 1-01-04 | 01 | 1 | DIST-01 | build | `npm run build` | ✅ | ⬜ pending |
| 1-01-05 | 01 | 2 | DIST-01 | manual | Open test-vault in Obsidian, confirm plugin listed | N/A | ⬜ pending |
| 1-01-06 | 01 | 2 | DIST-01 | manual | Trigger requestUrl() call, confirm no CORS error in console | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `node_modules/` — run `npm install` (not yet installed)
- [ ] `test-vault/.obsidian/plugins/ai-active-recall/.hotreload` — create empty file to enable hot-reload

*These must complete before any build tasks run.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Plugin appears in Settings > Community Plugins | DIST-01 | Requires live Obsidian instance | Open test-vault in Obsidian, go to Settings > Community Plugins, confirm "AI Active Recall" listed and enabled with no console errors |
| esbuild hot-reload fires in < 2s on file save | DIST-01 (build) | Requires watch mode + Obsidian open | Run `npm run dev`, open test-vault, edit any src file, confirm terminal shows rebuild and Obsidian reloads plugin |
| requestUrl() works on desktop (no CORS error) | DIST-01 (HTTP) | Requires live Obsidian instance | Trigger smoke-test command, observe Notice or console output confirming HTTP 200 |
| requestUrl() works on mobile (no CORS error, no crash) | DIST-01 (HTTP) | Requires mobile device or simulator | Sync plugin to mobile Obsidian, trigger smoke-test command, confirm no crash |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

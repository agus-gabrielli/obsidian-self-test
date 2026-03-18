---
phase: 06-refinements-and-improvements
plan: 02
subsystem: ui
tags: [obsidian, settings, sidebar, css, loading-state, dropdown]

# Dependency graph
requires:
  - phase: 04-sidebar-implementation
    provides: ActiveRecallSidebarView with onGenerate and renderPanel

provides:
  - Model dropdown with 5 curated GPT models plus custom text-input fallback in settings
  - Per-folder loading state (generatingFolders Set) with spinner CSS during generation
  - Double-generation prevention via button-to-spinner swap

affects:
  - 06-03 (prompt extraction - shares sidebar.ts and settings.ts)
  - 07-final-release

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Re-render settings panel via this.display() on dropdown change to toggle conditional UI
    - Per-folder Set<string> to track in-progress work; try/finally guarantees cleanup

key-files:
  created: []
  modified:
    - src/settings.ts
    - src/sidebar.ts
    - styles.css

key-decisions:
  - "CURATED_MODELS = ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano'] - covers current OpenAI lineup at time of writing"
  - "isCustomModel check drives conditional rendering without extra component state"
  - "generatingFolders Set tracks per-folder loading; try/finally ensures delete even on error"

patterns-established:
  - "Settings conditional UI: compute boolean before render, use this.display() re-render to toggle sections"
  - "Sidebar loading: add to Set + refresh before async op; delete + refresh in finally block"

requirements-completed:
  - REFINE-UI

# Metrics
duration: 15min
completed: 2026-03-18
---

# Phase 6 Plan 2: Model Dropdown and Sidebar Loading Indicator Summary

**Settings model field replaced with a curated 5-model dropdown (plus custom text-input fallback) and sidebar buttons swap to an animated spinner during generation to prevent double-triggering.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-18T00:00:00Z
- **Completed:** 2026-03-18T00:15:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added `CURATED_MODELS` array and `CUSTOM_MODEL_VALUE` sentinel to settings.ts; replaced free-text model field with a dropdown that shows 5 curated GPT models and a "Custom model..." option that reveals a text input
- Added `generatingFolders: Set<string>` instance variable to `ActiveRecallSidebarView`; `onGenerate` now wraps generation in try/finally to guarantee loading state cleanup
- Updated `renderPanel` in both withSelfTest and withoutSelfTest loops to render a spinner + "Generating..." label instead of the button when that folder is generating
- Added spinner CSS (`.active-recall-loading`, `.active-recall-spinner`, `@keyframes active-recall-spin`, `.active-recall-loading-text`) to styles.css

## Task Commits

1. **Task 1: Model selection dropdown with curated list and custom option** - `6dac1ca` (feat)
2. **Task 2: Sidebar loading indicator during generation** - `c3ba250` (feat)

## Files Created/Modified

- `src/settings.ts` - Added CURATED_MODELS + CUSTOM_MODEL_VALUE; replaced text input with dropdown + conditional custom model text input
- `src/sidebar.ts` - Added generatingFolders Set; updated onGenerate with try/finally; updated renderPanel to swap button for spinner when generating
- `styles.css` - Added loading container, spinner animation, and loading text styles

## Decisions Made

- Used `isCustomModel = !CURATED_MODELS.includes(this.plugin.settings.model)` to drive conditional rendering without extra stored state - clean and computed at render time
- Re-render via `this.display()` in dropdown onChange to toggle the custom text input - standard Obsidian settings tab pattern
- `try/finally` in `onGenerate` ensures the folder is always removed from `generatingFolders` even if generation throws

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

A test failure appeared in `generation.test.ts` during Task 2 verification. Investigation confirmed it was caused by uncommitted WIP from another concurrent plan (06-03 prompt extraction) that was mixed into the working directory via git stash. The failure is out of scope - sidebar tests (10/10) and TypeScript check both pass clean.

## Next Phase Readiness

- Settings dropdown and sidebar loading state are production-ready
- 06-03 (prompt extraction) can proceed; both files it touches (sidebar.ts, settings.ts) are now at their updated baseline
- 07-final-release can include these UI improvements in the updated release build

---
*Phase: 06-refinements-and-improvements*
*Completed: 2026-03-18*

## Self-Check: PASSED

- src/settings.ts: FOUND
- src/sidebar.ts: FOUND
- styles.css: FOUND
- Commit 6dac1ca (Task 1): FOUND
- Commit c3ba250 (Task 2): FOUND

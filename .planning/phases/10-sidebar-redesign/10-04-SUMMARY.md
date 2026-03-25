---
phase: 10-sidebar-redesign
plan: "04"
subsystem: ui
tags: [obsidian, sidebar, typescript, dom, ux]

# Dependency graph
requires:
  - phase: 10-03
    provides: tabbed sidebar with folders/tags/links panels, human verify build
provides:
  - FolderPickerModal for new folder generation
  - Generating banner in sidebar during any active generation
  - Spinner fix for existing entries (key added to Set before refresh)
  - Placeholder rows for new items being generated
  - Auto-open sidebar on correct tab before non-sidebar commands
  - CSS for .active-recall-generating-banner
affects: [11-release]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Generating Set ownership: sidebar adds/removes key around generate() call so spinner shows before async LLM starts"
    - "openSidebarWithTab: ensures sidebar is open on correct tab before delegating generation to sidebar view"
    - "Placeholder row pattern: iterate generating Set, filter out already-rendered keys, render isGenerating=true rows"

key-files:
  created: []
  modified:
    - src/modals.ts
    - src/sidebar.ts
    - src/main.ts
    - styles.css

key-decisions:
  - "Sidebar generates pre-add to Set then calls generationService.generate() - service also adds (no-op Set) and removes in finally; sidebar's finally is second no-op delete. Clean double-guard pattern."
  - "renderFoldersPanel removes Not generated section entirely - sidebar only shows what has been generated plus in-progress placeholders"
  - "openSidebarWithTab saves activeTab to settings before activating so sidebar reopens on correct tab even if it was closed"

patterns-established:
  - "Placeholder row: isGenerating=true row rendered when generating Set has key with no matching file"

requirements-completed: [UI-03, UI-04]

# Metrics
duration: 3min
completed: 2026-03-25
---

# Phase 10 Plan 04: Sidebar UX Polish (Gap Closure) Summary

**FolderPickerModal, generating banner, spinner fix for existing entries, placeholder rows, and auto-open sidebar wired to all command entry points**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-25T23:40:31Z
- **Completed:** 2026-03-25T23:43:00Z
- **Tasks:** 1 of 2 (Task 2 is checkpoint:human-verify, paused)
- **Files modified:** 4

## Accomplishments

- FolderPickerModal added to modals.ts - shows all eligible folders, filters by query, calls onSelect(folderPath)
- renderFoldersPanel rewritten: "Generate for new folder" button at top, only generated folders shown (no "Not generated" section), placeholder rows for in-progress folders
- Generating banner added to renderPanel - appears when any generating Set has entries, shows spinner + "Generating self-test..." with accent-tinted background
- Spinner bug fixed: sidebar adds key to generatingFolders/Tags/Links before refresh, so existing entries show spinner immediately before async LLM work starts
- Placeholder rows added to Tags and Links panels for items being generated with no output file yet
- openSidebarWithTab helper created in main.ts, wired to folder command, tag command, links command, and folder context menu

## Task Commits

1. **Task 1: Implement all sidebar UX fixes** - `d058403` (feat)

**Plan metadata:** (pending - checkpoint reached)

## Files Created/Modified

- `src/modals.ts` - Added FolderPickerModal extending SuggestModal<TFolder>
- `src/sidebar.ts` - Generating banner, rewritten renderFoldersPanel, placeholder rows in all panels, spinner bug fix in generateFor* methods
- `src/main.ts` - Added openSidebarWithTab helper, wired to all command entry points
- `styles.css` - Added .active-recall-generating-banner CSS rule

## Decisions Made

- Sidebar owns generating Set adds/removes around generate() calls so spinner is visible before the async LLM work starts. The GenerationService also adds/removes (its own lifecycle management) - the Set handles double-add/delete safely.
- renderFoldersPanel no longer shows "Not generated" folders - only generated ones plus in-progress placeholders. This reduces noise and makes the panel purpose clear.
- openSidebarWithTab saves activeTab to settings so the tab persists if the user reopens the sidebar later.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - 134 tests pass, 0 TypeScript errors.

## Known Stubs

None.

## Next Phase Readiness

- All sidebar UX gaps from human-verify feedback are implemented
- Task 2 (checkpoint:human-verify) requires human verification in Obsidian before closing this plan
- After human verify, Phase 10 is fully complete and Phase 11 (v2.0 Release) can begin

---
*Phase: 10-sidebar-redesign*
*Completed: 2026-03-25*

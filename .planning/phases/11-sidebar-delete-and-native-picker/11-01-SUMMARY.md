---
phase: 11-sidebar-delete-and-native-picker
plan: 01
subsystem: ui
tags: [obsidian, sidebar, modal, vault-api, typescript, jest]

# Dependency graph
requires:
  - phase: 10-sidebar-redesign
    provides: renderSelfTestRow shared row renderer across all three tabs

provides:
  - DeleteConfirmModal class in modals.ts (Obsidian modal with Cancel/Delete buttons and file path display)
  - Trash icon on sidebar rows via renderSelfTestRow onDelete parameter
  - FuzzySuggestModal mock class in obsidian mock (Plan 02 prerequisite)
  - Clean buildFrontmatter output (source_mode, source, source_notes only)

affects:
  - 11-02 (FuzzySuggestModal mock ready for linked notes picker)
  - collectors.ts consumers (frontmatter output changed)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "vault.trash(file, true) - respects user's Obsidian trash setting (moves to .trash/, system trash, or permanent delete)"
    - "onDelete: (() => void) | null parameter pattern - nullable callback for conditional trash icon"

key-files:
  created: []
  modified:
    - src/modals.ts
    - src/sidebar.ts
    - styles.css
    - src/__mocks__/obsidian.ts
    - src/__tests__/sidebar.test.ts
    - src/collectors.ts
    - src/__tests__/collectors.test.ts

key-decisions:
  - "renderSelfTestRow receives onDelete as 7th parameter (nullable) - null hides trash icon, non-null shows it; cleaner than isPlaceholder flag"
  - "vault.trash(file, true) passes system=true to respect vault trash setting per D-01"
  - "Trash icon hidden during generation (isGenerating check) and on placeholder rows (file null check) per D-07 and D-08"
  - "Spaced repetition frontmatter fields removed - always null/0/1, unused, clutter every generated file"

patterns-established:
  - "Trash icon pattern: createEl button with active-recall-trash-btn cls + setIcon(trashBtn, 'trash-2') + stopPropagation on click"

requirements-completed:
  - DEL-01
  - DEL-02

# Metrics
duration: 20min
completed: 2026-03-25
---

# Phase 11 Plan 01: Add Trash Icon to Sidebar Rows Summary

**Trash icon on all three sidebar panels (tags/links/folders) using vault.trash() with DeleteConfirmModal confirmation, plus FuzzySuggestModal mock for Plan 02 and clean frontmatter without unused spaced repetition fields**

## Performance

- **Duration:** 20 min
- **Started:** 2026-03-25T00:00:00Z
- **Completed:** 2026-03-25T00:20:00Z
- **Tasks:** 1
- **Files modified:** 7

## Accomplishments

- DeleteConfirmModal class added to modals.ts with file path in dialog body (per D-03)
- Trash icon added to renderSelfTestRow - hidden during generation and on placeholder rows (D-07, D-08)
- All three panels (folders, tags, links) pass onDelete callback pointing to deleteSelfTest()
- FuzzySuggestModal mock class ready in obsidian mock for Plan 02
- buildFrontmatter outputs only source_mode, source, source_notes (removed last_review, next_review, review_count, review_interval_days per D-13)
- 3 new sidebar tests for trash icon presence/absence; 137 total tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Add DeleteConfirmModal, trash icon to sidebar rows, FuzzySuggestModal mock** - `eb7fa9f` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `src/modals.ts` - Added DeleteConfirmModal class at end of file
- `src/sidebar.ts` - Added setIcon import, DeleteConfirmModal import, updated renderSelfTestRow signature (7th param), added deleteSelfTest() method, updated all 6 call sites
- `styles.css` - Added .active-recall-trash-btn and .active-recall-confirm-buttons styles
- `src/__mocks__/obsidian.ts` - Added FuzzySuggestModal class, setIcon export, vault.trash mock, App interface vault.trash type
- `src/__tests__/sidebar.test.ts` - Added 3 trash icon tests
- `src/collectors.ts` - Removed 4 spaced repetition fields from buildFrontmatter return value
- `src/__tests__/collectors.test.ts` - Added 4 negative assertions for removed frontmatter fields

## Decisions Made

- renderSelfTestRow 7th parameter is `onDelete: (() => void) | null` - null means no trash icon rendered; simpler than adding a boolean flag
- `vault.trash(file, true)` with system=true so the delete respects the user's Obsidian trash configuration
- Trash icon placed after the Generate/Regenerate button to match D-05 (right side of row)
- setIcon mock is a no-op function export - tests don't need icon rendering, just need it not to throw

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 02 (FuzzySuggestModal-based linked notes picker): FuzzySuggestModal mock is in place
- DeleteConfirmModal is exported and ready for any additional reuse
- All 137 tests pass, 0 TypeScript errors

---
*Phase: 11-sidebar-delete-and-native-picker*
*Completed: 2026-03-25*

---
phase: 09-flexible-note-collection
plan: 01
subsystem: testing
tags: [typescript, obsidian-api, tdd, jest, collectors, tags, links]

# Dependency graph
requires:
  - phase: 08-multi-provider-llm-dispatch
    provides: "Generation pipeline (callLLM, NoteSource, GenerationService) that collectors feed into"
provides:
  - "CollectionSpec discriminated union type (folder/tag/links/note)"
  - "collectNotesByTag - hierarchical tag matching, case-insensitive, excludes self-test files"
  - "getAllVaultTags - vault-wide tag frequency map"
  - "collectNotesByLinks - BFS traversal of resolvedLinks graph with depth control"
  - "buildTagOutputPath, buildLinksOutputPath, buildNoteOutputPath - path builders"
  - "writeOutputToPath - directory-creating file writer"
  - "buildFrontmatter - YAML header with source traceability"
  - "isSelfTestFile - exclusion guard"
  - "Extended obsidian mock with metadataCache, getAllTags, vault.getFiles/getFileByPath/createFolder, TFile.parent, SuggestModal, Modal"
affects: ["09-02", "09-03", "10-sidebar-redesign"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Discriminated union CollectionSpec enables exhaustive switch on mode in buildFrontmatter"
    - "BFS with visited Set<string> prevents infinite loop in circular link graphs"
    - "getAllTags(cache) called after null-guard on cache to satisfy real obsidian type signature"
    - "Mock TFile passed with 'as any' in tests to bridge mock/real TFile type gap (same pattern as generation.test.ts)"

key-files:
  created:
    - "src/collectors.ts"
    - "src/__tests__/collectors.test.ts"
  modified:
    - "src/__mocks__/obsidian.ts"

key-decisions:
  - "CollectionSpec uses discriminated union (not a flat options bag) - exhaustive switch in buildFrontmatter enforces handling of all modes"
  - "getAllTags null-guard: cache ? getAllTags(cache) : [] - real obsidian type requires non-null CachedMetadata"
  - "isSelfTestFile checks basename === '_self-test', path.startsWith('_self-tests/'), and basename.endsWith('_self-test') - covers all three output path conventions"
  - "BFS depth guard is item.d >= depth (strict), not item.d > depth - item at d=0 processes links at d=1, stopping at depth threshold"

patterns-established:
  - "Collector pattern: get all vault files, filter by extension+isSelfTestFile, check metadataCache per file"
  - "Output path convention: tags -> _self-tests/tags/<tag>.md, links -> _self-tests/links/<basename>.md, single-note -> same-folder or centralized"

requirements-completed: [COL-01, COL-02, COL-03, COL-04, COL-05, COL-07]

# Metrics
duration: 4min
completed: 2026-03-21
---

# Phase 9 Plan 01: Flexible Note Collectors Summary

**Pure collector functions for tag, links, and single-note modes with BFS graph traversal, hierarchical tag matching, and output path builders - all TDD with 30 tests**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-21T23:46:53Z
- **Completed:** 2026-03-21T23:50:13Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Built all 9 exported functions in `src/collectors.ts` with zero TypeScript errors
- Extended obsidian mock with 6 new fields (metadataCache, getAllTags, 3 vault methods, TFile.parent, SuggestModal, Modal)
- 30 collector tests all passing; existing 91 tests unaffected (121 total, up from 84 after phase 8)

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend obsidian mock and write failing collector tests (RED)** - `3e665d4` (test)
2. **Task 2: Implement src/collectors.ts to make all tests pass (GREEN)** - `32011d9` (feat)

## Files Created/Modified

- `src/collectors.ts` - CollectionSpec type and all 9 collector/path-builder/helper functions
- `src/__tests__/collectors.test.ts` - 30 test cases covering COL-01 through COL-07
- `src/__mocks__/obsidian.ts` - Extended with metadataCache, getAllTags, vault.getFiles/getFileByPath/createFolder, TFile.parent, SuggestModal, Modal

## Decisions Made

- `CollectionSpec` uses a discriminated union rather than a flat options bag - exhaustive switch in `buildFrontmatter` enforces all modes are handled at compile time
- `getAllTags` null-guard added (`cache ? getAllTags(cache) : []`) because the real obsidian type signature requires a non-null `CachedMetadata` argument
- `isSelfTestFile` checks three patterns to cover all output path conventions the plugin writes
- BFS depth guard `item.d >= depth` stops processing links at the exact depth threshold; files at depth=1 are collected, their links are not followed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed getAllTags null argument TypeScript error**
- **Found during:** Task 2 (collectors.ts implementation), during `npx tsc --noEmit`
- **Issue:** `getAllTags(cache)` passed `CachedMetadata | null` but real obsidian type requires `CachedMetadata` (non-nullable)
- **Fix:** Added null guard: `cache ? getAllTags(cache) ?? [] : []`
- **Files modified:** src/collectors.ts (two call sites)
- **Verification:** `npx tsc --noEmit` exits 0
- **Committed in:** 32011d9 (Task 2 commit)

**2. [Rule 1 - Bug] Added `as any` casts in test for mock TFile / real TFile type mismatch**
- **Found during:** Task 2, during `npx tsc --noEmit`
- **Issue:** Mock TFile lacks `vault` and `name` fields from real obsidian TFile; test calls to `collectNotesByLinks`, `isSelfTestFile`, `buildLinksOutputPath`, `buildNoteOutputPath`, `buildFrontmatter` caused TS errors
- **Fix:** Added `as any` casts at call sites in collectors.test.ts (same pattern already used for `app as any` throughout codebase)
- **Files modified:** src/__tests__/collectors.test.ts
- **Verification:** `npx tsc --noEmit` exits 0; `npx jest` still 30/30 pass
- **Committed in:** 32011d9 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - type correctness)
**Impact on plan:** Both fixes required for TypeScript correctness only. Runtime behavior unchanged. No scope creep.

## Issues Encountered

None - plan executed as specified once TS errors were resolved.

## Known Stubs

None - all functions are fully implemented and tested.

## Next Phase Readiness

- `CollectionSpec`, all 9 collector functions, and extended obsidian mock are ready for Plan 02 (modals + GenerationService refactor)
- Plan 02 can import directly from `src/collectors.ts` without modification
- No blockers

## Self-Check: PASSED

All created files found on disk. All task commits verified in git history.

---
*Phase: 09-flexible-note-collection*
*Completed: 2026-03-21*

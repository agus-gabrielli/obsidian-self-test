---
phase: 07-provider-settings-and-migration
plan: 01
subsystem: settings
tags: [typescript, settings, migration, multi-provider, openai, gemini, anthropic]

requires: []
provides:
  - Nested per-provider settings shape (ActiveRecallSettings with openai/gemini/anthropic sub-objects)
  - PROVIDER_CONFIG record with model lists, defaults, placeholders, and labels for all three providers
  - migrateV1Settings pure function that safely upgrades v1 flat apiKey/model to nested openai config
  - Updated generation.ts call sites reading from settings[settings.provider]
  - Updated loadSettings() running migration before Object.assign
affects:
  - 07-02 (settings UI - provider switcher and per-provider key/model inputs)
  - 08 (multi-provider LLM dispatch - reads same nested settings shape)

tech-stack:
  added: []
  patterns:
    - "Nested per-provider settings: settings[settings.provider].apiKey / settings[settings.provider].model"
    - "Migration-before-merge: migrateV1Settings(savedData) called before Object.assign({}, DEFAULT_SETTINGS, savedData)"
    - "Pure migration helper: migrateV1Settings exported from settings.ts for independent testability"

key-files:
  created:
    - src/__tests__/settings.test.ts
  modified:
    - src/settings.ts
    - src/generation.ts
    - src/main.ts
    - src/__tests__/generation.test.ts
    - src/__mocks__/obsidian.ts

key-decisions:
  - "Nested per-provider config (openai/gemini/anthropic sub-objects) is the canonical settings shape from this point forward"
  - "migrateV1Settings deletes flat apiKey/model/customModel after migration so they never persist to data.json again"
  - "generation.ts extracts providerCfg at top of generate() - single lookup, three call sites read from it"
  - "PluginSettingTab and Setting added to obsidian mock so settings tests can import from settings.ts without Obsidian runtime"

patterns-established:
  - "Settings access: this.settings[this.settings.provider].apiKey and .model - do not use flat fields"
  - "Migration check: hasFlat && !hasNested guards - never overwrites existing nested config"

requirements-completed: [PROV-07, PROV-01, PROV-02, PROV-03]

duration: 2min
completed: 2026-03-21
---

# Phase 07 Plan 01: Provider Settings and Migration Summary

**Nested per-provider settings shape with v1-to-v2 migration, PROVIDER_CONFIG for OpenAI/Gemini/Anthropic, and updated generation call sites - 69 tests pass, zero TypeScript errors**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-21T19:27:40Z
- **Completed:** 2026-03-21T19:29:46Z
- **Tasks:** 2
- **Files modified:** 5 (+ 1 created)

## Accomplishments

- Expanded `LLMProvider` to a 3-member union (`openai | gemini | anthropic`) and restructured `ActiveRecallSettings` to nested per-provider config objects
- Added `PROVIDER_CONFIG` record with model lists, defaults, placeholders, and labels for all three providers - single source of truth for UI and dispatch
- Implemented and tested `migrateV1Settings` - a pure function that safely lifts v1 flat `apiKey`/`model` fields into `openai` nested config without destroying existing keys
- Updated all three `callLLM` call sites in `generation.ts` to read from `settings[settings.provider]`
- Updated `loadSettings()` in `main.ts` to run migration before `Object.assign` merge
- 69 tests pass (10 new settings/migration tests + 59 existing)

## Task Commits

1. **Task 1: Expand settings interface, add PROVIDER_CONFIG, create migration helper, and write migration tests** - `2dd1085` (feat)
2. **Task 2: Update generation.ts call sites and main.ts loadSettings, fix all existing tests** - `13fedbb` (feat)

## Files Created/Modified

- `src/settings.ts` - LLMProvider expanded, ProviderMeta + PROVIDER_CONFIG added, ActiveRecallSettings restructured to nested shape, migrateV1Settings added, SettingTab updated to read from nested config
- `src/__tests__/settings.test.ts` - 10 tests covering migration edge cases and PROVIDER_CONFIG shape
- `src/generation.ts` - providerCfg local variable extracts settings[provider], all 3 callLLM calls updated
- `src/main.ts` - import updated to include migrateV1Settings, loadSettings() runs migration before merge
- `src/__tests__/generation.test.ts` - defaultSettings fixture updated to nested shape
- `src/__mocks__/obsidian.ts` - Added PluginSettingTab and Setting mock classes (Rule 3 fix)

## Decisions Made

- `migrateV1Settings` deletes flat fields (`apiKey`, `model`, `customModel`) unconditionally after migration so they never re-persist to `data.json` on next save
- `generation.ts` extracts `providerCfg` at the top of `generate()` as a single local variable - three call sites all read from it rather than re-indexing each time
- `PluginSettingTab` and `Setting` added to the obsidian mock so `settings.test.ts` can import the module without hitting the Obsidian runtime (Rule 3 - blocking fix)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added PluginSettingTab and Setting mocks to obsidian mock**
- **Found during:** Task 1 (running settings tests)
- **Issue:** `settings.ts` imports `PluginSettingTab` and `Setting` from `obsidian`, but the mock only exported `TFile`, `TFolder`, `Notice`, etc. The test suite failed to run with "Class extends value undefined"
- **Fix:** Added minimal `PluginSettingTab` and `Setting` stub classes to `src/__mocks__/obsidian.ts`
- **Files modified:** `src/__mocks__/obsidian.ts`
- **Verification:** All 10 settings tests pass after fix
- **Committed in:** `2dd1085` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 - blocking)
**Impact on plan:** Required to run settings tests at all. No scope creep.

## Issues Encountered

None beyond the mock gap above.

## Next Phase Readiness

- Settings data shape is locked and tested - Phase 07-02 (settings UI) and Phase 08 (dispatch) can build on this
- `PROVIDER_CONFIG` is ready for the provider dropdown UI in 07-02
- `migrateV1Settings` protects existing users' OpenAI keys on first upgrade to v2
- No stubs - all data paths fully wired for the active provider

---
*Phase: 07-provider-settings-and-migration*
*Completed: 2026-03-21*

# Roadmap: Obsidian Active Recall Plugin

## Overview

Five phases that follow the natural dependency order of the plugin: first a working scaffold with the correct manifest and build config, then settings (everything else reads from them), then the generation pipeline (the core value), then the UI entry points that wire into the pipeline, and finally release preparation. Each phase delivers a verifiable capability. Nothing in a later phase can be built without the previous one in place.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Working plugin scaffold loads in Obsidian with correct manifest, build config, and requestUrl() HTTP pattern locked in
- [x] **Phase 2: Settings** - Full settings tab with provider, API key, model, language, toggles, and custom instructions persists correctly (completed 2026-03-10)
- [ ] **Phase 3: Generation Pipeline** - End-to-end self-test generation from note collection through LLM call to _self-test.md output, including batch+synthesize and user feedback
- [ ] **Phase 4: Commands and Sidebar** - All entry points wired (command palette, context menu, sidebar panel) calling the live generation pipeline
- [ ] **Phase 5: Polish and Release** - Production-quality error handling, README, and verified store submission compliance

## Phase Details

### Phase 1: Foundation
**Goal**: A working Obsidian plugin scaffold that loads cleanly, uses the correct build config, has a store-compliant manifest, and establishes the requestUrl() HTTP pattern before any feature work begins
**Depends on**: Nothing (first phase)
**Requirements**: DIST-01
**Success Criteria** (what must be TRUE):
  1. Plugin loads in Obsidian without errors (appears in Settings > Community Plugins)
  2. esbuild watch mode rebuilds and hot-reload restarts the plugin in under 2 seconds on file save
  3. manifest.json has plugin ID `ai-active-recall`, correct minAppVersion, and passes the Obsidian submission format check
  4. A smoke-test requestUrl() call to an external endpoint succeeds on both desktop and mobile (no CORS error, no crash)
**Plans**: 1 plan

Plans:
- [x] 01-01-PLAN.md - Install deps, rewrite scaffold to ActiveRecallPlugin, verify plugin loads + requestUrl() smoke test passes

### Phase 2: Settings
**Goal**: Users can configure the plugin fully - provider, API key, model, language, output toggles, and custom instructions - with the configuration persisting across Obsidian restarts
**Depends on**: Phase 1
**Requirements**: SET-01, SET-02, SET-03, SET-04, SET-05, SET-06, SET-07, SET-08
**Success Criteria** (what must be TRUE):
  1. User can open the plugin settings tab and see all configuration options (provider, API key, model, language, toggles, custom instructions)
  2. API key field is masked (password input) and the settings UI shows a visible warning about Git/data.json exposure risk
  3. All settings survive an Obsidian restart - values entered in one session appear correctly in the next
  4. Toggling hints, reference answers, or concept map off and back on saves correctly without resetting other settings
**Plans**: 1 plan

Plans:
- [ ] 02-01-PLAN.md - Populate settings interface/defaults, implement full settings tab display(), remove smoke test

### Phase 3: Generation Pipeline
**Goal**: A user can trigger generation from the command palette and get a correctly formatted _self-test.md written to the selected folder, with token budget enforcement, batch+synthesize for large folders, and clear progress and error feedback throughout
**Depends on**: Phase 2
**Requirements**: GEN-01, GEN-02, GEN-03, GEN-04, GEN-05, GEN-06, GEN-07, CTX-01, CTX-02, CTX-03, FB-01, FB-02
**Success Criteria** (what must be TRUE):
  1. Running "Generate Self-Test for Current Folder" on a folder with 3-5 notes produces a _self-test.md with a concept map, categorized open-ended questions ordered foundational to advanced, collapsible hints, and collapsible reference answers - all in standard Obsidian markdown
  2. Running the same command on a folder whose total note content exceeds the token budget produces a correct _self-test.md via batch+synthesize (no API error, no truncation)
  3. A visible progress indicator appears during generation and disappears when complete
  4. When the API key is wrong or the network fails, the user sees a plain-language error message (not a raw API error string)
  5. Re-running generation on a folder that already has _self-test.md overwrites it silently with fresh output
**Plans**: TBD

### Phase 4: Commands and Sidebar
**Goal**: Users can trigger generation from three surfaces - command palette, folder context menu, and the sidebar panel - and the sidebar accurately reflects which folders have self-tests and which do not
**Depends on**: Phase 3
**Requirements**: CMD-01, CMD-02, CMD-03, UI-01, UI-02
**Success Criteria** (what must be TRUE):
  1. Right-clicking any folder in the file explorer shows "Generate Self-Test" and triggers generation for that folder
  2. The sidebar panel lists folders that have _self-test.md (with last-generated date and a Regenerate button) and folders that do not (with a Generate button)
  3. After generation completes from any entry point, the sidebar panel reflects the updated state without requiring a manual refresh
  4. Disabling and re-enabling the plugin does not create duplicate sidebar panes
**Plans**: TBD

### Phase 5: Polish and Release
**Goal**: The plugin is ready for Obsidian community store submission - README covers setup, error messages are user-friendly throughout, mobile works without crashes, and all store submission requirements are verified
**Depends on**: Phase 4
**Requirements**: DIST-02
**Success Criteria** (what must be TRUE):
  1. README explains installation, API key configuration, and basic usage clearly enough for a non-technical Obsidian user
  2. All error states (wrong key, rate limit, network error, no notes in folder, context exceeded) produce a plain-language message with a clear action the user can take
  3. Plugin loads and generation runs on Obsidian mobile without crashing (API key input may be less ergonomic but must be functional)
  4. GitHub release tag matches manifest.json version exactly (no `v` prefix) and all store submission checklist items pass
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 1/1 | Complete | 2026-03-09 |
| 2. Settings | 1/1 | Complete   | 2026-03-10 |
| 3. Generation Pipeline | 0/? | Not started | - |
| 4. Commands and Sidebar | 0/? | Not started | - |
| 5. Polish and Release | 0/? | Not started | - |

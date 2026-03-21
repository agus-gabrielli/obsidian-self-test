# Roadmap: Obsidian Active Recall Plugin

## Overview

Five phases that follow the natural dependency order of the plugin: first a working scaffold with the correct manifest and build config, then settings (everything else reads from them), then the generation pipeline (the core value), then the UI entry points that wire into the pipeline, and finally release preparation. Each phase delivers a verifiable capability. Nothing in a later phase can be built without the previous one in place.

---

## v1.0 Phases (Complete - Historical Record)

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Working plugin scaffold loads in Obsidian with correct manifest, build config, and requestUrl() HTTP pattern locked in
- [x] **Phase 2: Settings** - Full settings tab with provider, API key, model, language, toggles, and custom instructions persists correctly (completed 2026-03-10)
- [x] **Phase 3: Generation Pipeline** - End-to-end self-test generation from note collection through LLM call to _self-test.md output, including batch+synthesize and user feedback (completed 2026-03-10)
- [x] **Phase 4: Commands and Sidebar** - All entry points wired (command palette, context menu, sidebar panel) calling the live generation pipeline (completed 2026-03-12)
- [x] **Phase 5: Polish and Release** - Production-quality error handling, README, and GitHub release published (store submission deferred to Phase 6)
- [x] **Phase 6: Refinements** - Prompt quality (Mermaid concept maps, contextual hints, source traceability), model dropdown, sidebar spinner, README science section (completed 2026-03-19)

---

## v2.0 Phases

- [ ] **Phase 7: Provider Settings and Migration** - Users can select and configure any of three LLM providers with per-provider API keys and model selection; existing OpenAI keys are migrated automatically
- [ ] **Phase 8: Multi-Provider LLM Dispatch** - Plugin successfully calls Gemini and Claude APIs in addition to OpenAI; provider-specific errors are surfaced with the provider name
- [ ] **Phase 9: Flexible Note Collection** - Users can generate self-tests from notes by tag, by linked notes from a root note, or from a single note
- [ ] **Phase 10: Sidebar Redesign** - Sidebar supports all four generation modes with clear navigation and shows tag/link-based self-tests alongside folder-based ones
- [ ] **Phase 11: v2.0 Release** - README updated with multi-provider and collection mode documentation; plugin passes Obsidian store review and PR is submitted

---

## v1.0 Phase Details (Historical)

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
- [x] 02-01-PLAN.md - Populate settings interface/defaults, implement full settings tab display(), remove smoke test

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
**Plans**: 3 plans

Plans:
- [x] 03-01-PLAN.md - Install Jest test infrastructure, create obsidian mock, write 14 stub tests covering all 12 requirements
- [x] 03-02-PLAN.md - Implement GenerationService in src/generation.ts via TDD - all 14 tests green
- [x] 03-03-PLAN.md - Wire status bar item and command into main.ts; human-verify full flow in Obsidian

### Phase 4: Commands and Sidebar
**Goal**: Users can trigger generation from three surfaces - command palette, folder context menu, and the sidebar panel - and the sidebar accurately reflects which folders have self-tests and which do not
**Depends on**: Phase 3
**Requirements**: CMD-01, CMD-02, CMD-03, UI-01, UI-02
**Success Criteria** (what must be TRUE):
  1. Right-clicking any folder in the file explorer shows "Generate Self-Test" and triggers generation for that folder
  2. The sidebar panel lists folders that have _self-test.md (with last-generated date and a Regenerate button) and folders that do not (with a Generate button)
  3. After generation completes from any entry point, the sidebar panel reflects the updated state without requiring a manual refresh
  4. Disabling and re-enabling the plugin does not create duplicate sidebar panes
**Plans**: 3 plans

Plans:
- [x] 04-01-PLAN.md - Extend obsidian mock and write 10 failing sidebar tests (Wave 1)
- [x] 04-02-PLAN.md - Implement src/sidebar.ts with ActiveRecallSidebarView and helper functions (Wave 2)
- [x] 04-03-PLAN.md - Wire sidebar, CMD-02, CMD-03, ribbon into main.ts; human-verify in Obsidian (Wave 3)

### Phase 5: Polish and Release
**Goal**: The plugin is ready for Obsidian community store submission - README covers setup, error messages are user-friendly throughout, mobile works without crashes, and all store submission requirements are verified
**Depends on**: Phase 4
**Requirements**: DIST-02
**Success Criteria** (what must be TRUE):
  1. README explains installation, API key configuration, and basic usage clearly enough for a non-technical Obsidian user
  2. All error states (wrong key, rate limit, network error, no notes in folder, context exceeded) produce a plain-language message with a clear action the user can take
  3. Plugin loads and generation runs on Obsidian mobile without crashing (API key input may be less ergonomic but must be functional)
  4. GitHub release tag matches manifest.json version exactly (no `v` prefix) and all store submission checklist items pass
**Plans**: 3 plans

Plans:
- [x] 05-01-PLAN.md - Fix classifyError() (429 wording, context-exceeded branch) and update manifest description (Wave 1)
- [x] 05-02-PLAN.md - Rewrite README.md for non-technical Obsidian users (Wave 1)
- [x] 05-03-PLAN.md - Mobile decision, production build, GitHub release 1.0.0 published (Wave 2); store submission deferred to Phase 6

### Phase 6: Refinements
**Goal**: Improve prompt quality (Mermaid concept maps, contextual hints, source traceability), UX polish (model dropdown, sidebar loading spinner), and README (science foundations, differentiation) before the final store submission
**Requirements**: REFINE-PROMPTS, REFINE-UI, REFINE-README, REFINE-VERIFY
**Depends on**: Phase 5
**Plans**: 4/4 plans complete

Plans:
- [x] 06-01-PLAN.md - Extract prompts to src/prompts.ts with Mermaid concept maps, contextual hints, source traceability (Wave 1)
- [x] 06-02-PLAN.md - Model selection dropdown in settings + sidebar loading spinner (Wave 1)
- [x] 06-03-PLAN.md - README science foundations and differentiation from LLM Test Generator (Wave 1)
- [x] 06-04-PLAN.md - Build, test, and human-verify all refinements in Obsidian (Wave 2)

---

## v2.0 Phase Details

### Phase 7: Provider Settings and Migration
**Goal**: Users can select any of three LLM providers (OpenAI, Gemini, Claude) in settings with per-provider API key fields and model dropdowns; existing v1.0 users' OpenAI keys are preserved automatically on first load
**Depends on**: Phase 6
**Requirements**: PROV-01, PROV-02, PROV-03, PROV-07
**Success Criteria** (what must be TRUE):
  1. User can open settings and select OpenAI, Gemini, or Claude from a provider dropdown; the settings panel shows the correct API key field and model list for the selected provider
  2. User can enter and save a separate API key for each provider; switching providers does not clear or overwrite keys entered for other providers
  3. An existing v1.0 user who upgrades to v2.0 finds their OpenAI API key and model selection intact - the plugin migrates them automatically without prompting
  4. The model dropdown for each provider shows a curated list appropriate to that provider, plus a custom model option
**Plans**: 2 plans

Plans:
- [x] 07-01-PLAN.md - Settings interface refactor, PROVIDER_CONFIG, migration helper with tests, generation.ts call site updates (Wave 1)
- [ ] 07-02-PLAN.md - Rewrite display() for provider-scoped rendering, human-verify in Obsidian (Wave 2)

### Phase 8: Multi-Provider LLM Dispatch
**Goal**: The plugin routes generation calls to the correct provider API (OpenAI, Gemini, or Claude) based on the active settings selection, with provider-specific error messages when calls fail
**Depends on**: Phase 7
**Requirements**: PROV-04, PROV-05, PROV-06
**Success Criteria** (what must be TRUE):
  1. With Gemini selected and a valid Google AI Studio key, generation produces a correctly formatted _self-test.md using the Gemini API (generativelanguage.googleapis.com)
  2. With Claude selected and a valid Anthropic key, generation produces a correctly formatted _self-test.md using the Anthropic Messages API (api.anthropic.com)
  3. When a Gemini API call fails (wrong key, quota exceeded), the error message names Gemini specifically (e.g. "Gemini API key invalid") rather than showing a generic error
  4. When a Claude API call fails, the error message names Claude specifically; raw HTTP error strings are not shown to users
**Plans**: TBD

### Phase 9: Flexible Note Collection
**Goal**: Users can generate self-tests from notes gathered by tag, by following links from a root note, or from a single note - in addition to the existing folder mode
**Depends on**: Phase 7
**Requirements**: COL-01, COL-02, COL-03, COL-04, COL-05, COL-06, COL-07
**Success Criteria** (what must be TRUE):
  1. User can trigger tag-based generation from the command palette; a tag picker modal appears with autocomplete/filtering over all vault tags; selecting a tag collects all matching notes and generates a self-test written to `_self-tests/_self-test-<tag>.md`
  2. User can trigger linked-notes generation from the command palette; a note picker appears; selecting a root note collects the root note plus all its directly linked notes (depth 1) and generates a self-test in `_self-tests/`
  3. A depth-2 toggle in the linked-notes picker extends collection to links-of-links; toggling it on and triggering generation includes the second layer of linked notes
  4. Right-clicking any markdown file in the file explorer shows a "Generate Self-Test" option; selecting it generates a self-test for that single note written to the same folder as the source note (e.g. `my-note_self-test.md`)
  5. All three new modes feed the existing batch+synthesize pipeline unchanged - large note sets are handled without manual intervention
**Plans**: TBD

### Phase 10: Sidebar Redesign
**Goal**: The sidebar presents all four generation modes (folder, tag, linked notes, single note) in a clear navigable structure, and shows tag-based and link-based self-tests alongside folder-based ones
**Depends on**: Phase 9
**Requirements**: UI-03, UI-04
**Success Criteria** (what must be TRUE):
  1. The sidebar displays mode selector tabs (or equivalent navigation) for Folder, Tag, Links, and Note; switching between them renders a panel appropriate to that mode
  2. The Tag panel lists previously generated tag-based self-tests with their last-generated date and a Regenerate button, plus an input to generate for a new tag
  3. The Links panel lists previously generated link-based self-tests from `_self-tests/` alongside the folder-based ones; each shows last-generated date and a Regenerate button
  4. After generation from any mode completes, the sidebar reflects the updated state without requiring a manual refresh
**Plans**: TBD

### Phase 11: v2.0 Release
**Goal**: README documents multi-provider setup and all new collection modes clearly; the plugin passes Obsidian community store review requirements and the submission PR is open against obsidianmd/obsidian-releases
**Depends on**: Phase 10
**Requirements**: DIST-03, DIST-04
**Success Criteria** (what must be TRUE):
  1. README includes setup instructions for Google AI Studio and Anthropic API keys, with links to where users get them; existing OpenAI instructions remain accurate
  2. README documents all four generation modes (folder, tag, linked notes, single note) with enough detail for a non-technical user to use each one
  3. manifest.json version is bumped to 2.0.0; GitHub release tag matches exactly (no `v` prefix); all store submission checklist items pass
  4. PR is open against obsidianmd/obsidian-releases with the required files (manifest.json, main.js, styles.css) attached to the GitHub release
**Plans**: TBD

---

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10 -> 11

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 1/1 | Complete | 2026-03-09 |
| 2. Settings | 1/1 | Complete | 2026-03-10 |
| 3. Generation Pipeline | 3/3 | Complete | 2026-03-10 |
| 4. Commands and Sidebar | 3/3 | Complete | 2026-03-12 |
| 5. Polish and Release | 3/3 | Complete | 2026-03-17 |
| 6. Refinements | 4/4 | Complete | 2026-03-19 |
| 7. Provider Settings and Migration | 1/2 | In Progress|  |
| 8. Multi-Provider LLM Dispatch | 0/TBD | Not started | - |
| 9. Flexible Note Collection | 0/TBD | Not started | - |
| 10. Sidebar Redesign | 0/TBD | Not started | - |
| 11. v2.0 Release | 0/TBD | Not started | - |

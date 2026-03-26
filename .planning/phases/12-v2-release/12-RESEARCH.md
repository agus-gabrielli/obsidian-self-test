# Phase 12: v2.0 Release - Research

**Researched:** 2026-03-25
**Domain:** Plugin rename, README rewrite, Obsidian community store submission
**Confidence:** HIGH

## Summary

Phase 12 is a release preparation phase with two distinct work streams. The first is a mechanical rename that touches every file in the codebase containing `active-recall`, `ActiveRecall`, or `AI Active Recall`. The second is a public distribution task: rebuild the README for a multi-provider v2.0 plugin, then submit to the Obsidian community store via PR against obsidianmd/obsidian-releases.

The rename is fully audited. There are exactly eight source files needing changes, plus manifest.json and package.json. The rename has zero runtime state implications - this plugin has never been publicly released, so no existing installs can break. The only "migration" concern is keeping the `VIEW_TYPE` constant stable after rename so any user's workspace layout file (which stores leaf types by string) does not invalidate their sidebar pane - but since we're renaming the ID too (D-01), that's acceptable for a first public release.

Store submission is straightforward but has specific mechanical requirements: the GitHub release tag must exactly match the manifest version (no `v` prefix), three assets must be attached to the release (main.js, styles.css, manifest.json), and the PR adds one JSON entry to community-plugins.json. The automated bot validates that `id`, `name`, and `description` in community-plugins.json match manifest.json exactly.

**Primary recommendation:** Execute the rename as one atomic commit (all files together) so TypeScript compilation never sees a partial rename state. Then do a clean build, create the GitHub release, and open the store PR.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Plugin ID changes from `ai-active-recall` to `self-test` in manifest.json
- D-02: Full internal rename - TypeScript class names (`ActiveRecallPlugin` -> `SelfTestPlugin`, `ActiveRecallSidebarView` -> `SelfTestSidebarView`, `ActiveRecallSettings` -> `SelfTestSettings`, etc.)
- D-03: All CSS class prefixes change from `active-recall-*` to `self-test-*` (styles.css + all references in .ts files and tests)
- D-04: User-facing strings updated: sidebar title, command names ("Open Active Recall Panel" -> "Open Self Test Panel"), ribbon tooltip
- D-05: package.json name updated from `obsidian-sample-plugin` to `self-test`
- D-06: No migration needed - plugin has never been publicly released, so no existing installs to preserve
- D-07: README intro paragraph stays high-level - mentions what the plugin does without listing all modes
- D-08: Installation uses pick-one approach for provider setup: "Choose your provider in settings (OpenAI, Google Gemini, or Claude), then enter your API key" with links to all three key pages
- D-09: How to use section organized by mode (Folder, Tag, Linked Notes, Single Note) - each subsection explains what it does and how to trigger it
- D-10: Science section and differentiation section can be improved at Claude's discretion
- D-11: README targets non-technical Obsidian users (carried from Phase 5)
- D-12: Text-only - no screenshots or GIFs (carried from Phase 5)
- D-13: Version is 1.0.0 (first public release - internal v1/v2 milestone distinction is not exposed)
- D-14: `isDesktopOnly: true` - no mobile testing done, safe default for first release
- D-15: GitHub release tag must match manifest version exactly (no `v` prefix)
- D-16: Release assets: main.js, styles.css, manifest.json attached to GitHub release
- D-17: PR opened against obsidianmd/obsidian-releases with plugin entry

### Claude's Discretion
- Exact README prose and section ordering
- Science section improvements
- Differentiation section improvements
- Ribbon icon choice (currently `brain-circuit` - may want to reconsider for "Self Test" branding)
- Store submission PR description and format
- versions.json content (1.0.0 mapping)

### Deferred Ideas (OUT OF SCOPE)
- Flip `isDesktopOnly: false` after manual mobile testing - future update
- Screenshots and GIFs in README - post-release improvement
- Custom OpenAI-compatible endpoint support - future scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DIST-03 | README updated with new provider setup instructions and collection mode usage | D-07 through D-12 lock the README structure; Section "README Content Architecture" below defines required sections and copy |
| DIST-04 | Plugin passes Obsidian community store review and PR is submitted to obsidianmd/obsidian-releases | Store submission checklist verified from obsidianmd/obsidian-releases PR template; all checklist items mapped below |
</phase_requirements>

---

## Standard Stack

This phase uses no new libraries. All tooling is already installed.

### Core (already present)
| Tool | Purpose | Notes |
|------|---------|-------|
| esbuild | Production build (`npm run build`) | Already configured in esbuild.config.mjs |
| TypeScript | Compile-time rename verification | `tsc -noEmit` catches all broken imports |
| Jest | Test suite verification after rename | 137 tests currently passing |

### Installation
No new packages needed.

### Version verification
manifest.json currently at `1.0.0`. Decision D-13 keeps it at `1.0.0` (first public release). versions.json already maps `"1.0.0": "0.15.0"` - no change needed there.

---

## Architecture Patterns

### Rename Execution Pattern
**What:** A complete string replacement across all TypeScript, CSS, and JSON files in a single commit
**When to use:** Any rename that affects TypeScript types and their consumers - partial states cause compilation errors
**Why atomic:** TypeScript's type checker will reject a partial rename (e.g., `SelfTestPlugin` importing `ActiveRecallSettings`) before the whole rename is complete. A single commit avoids any intermediate broken state.

### Rename Targets - Complete Audit

Verified by grep across all non-planning source files. Every occurrence is listed.

**manifest.json** (2 changes)
- `"id": "ai-active-recall"` -> `"id": "self-test"`
- `"name": "AI Active Recall"` -> `"name": "Self Test"`
- `"description"` - update to reflect v2.0 multi-provider capabilities (currently too narrow)

**package.json** (2 changes)
- `"name": "obsidian-sample-plugin"` -> `"name": "self-test"`
- `"description": "This is a sample plugin for Obsidian (https://obsidian.md)"` -> accurate description

**src/main.ts** (TypeScript identifiers and strings)
- Class: `ActiveRecallPlugin` -> `SelfTestPlugin`
- Import references to `ActiveRecallSettings`, `ActiveRecallSettingTab`, `VIEW_TYPE_ACTIVE_RECALL`, `ActiveRecallSidebarView`
- Local type annotations using those names
- `openSidebarWithTab` parameter type: `ActiveRecallPlugin` -> `SelfTestPlugin`
- `getSidebarView` return type annotation: `ActiveRecallSidebarView` -> `SelfTestSidebarView`
- Command id: `'open-active-recall-panel'` -> `'open-self-test-panel'`
- Command name: `'Open Active Recall Panel'` -> `'Open Self Test Panel'`
- Ribbon tooltip: `'Open Active Recall Panel'` -> `'Open Self Test Panel'`

**src/sidebar.ts** (TypeScript identifiers and strings)
- `VIEW_TYPE_ACTIVE_RECALL = 'active-recall-panel'` -> `VIEW_TYPE_SELF_TEST = 'self-test-panel'`
- Class: `ActiveRecallSidebarView` -> `SelfTestSidebarView`
- Import reference: `type ActiveRecallPlugin` -> `type SelfTestPlugin`
- `getDisplayText()` returns `'Active Recall'` -> `'Self Test'`
- Header text: `'Active Recall'` (line 162) -> `'Self Test'`
- All CSS class string literals: `'active-recall-*'` -> `'self-test-*'` (~25 occurrences)

**src/settings.ts** (TypeScript identifiers)
- Interface: `ActiveRecallSettings` -> `SelfTestSettings`
- Class: `ActiveRecallSettingTab` -> `SelfTestSettingTab`
- Import reference: `type ActiveRecallPlugin` -> `type SelfTestPlugin`
- `DEFAULT_SETTINGS` constant type annotation
- Constructor parameter type annotation

**src/generation.ts** (TypeScript type references only - no user-facing strings)
- Import: `ActiveRecallSettings` -> `SelfTestSettings`
- All local type annotations using `ActiveRecallSettings`

**src/modals.ts** (CSS class string literals only)
- `'active-recall-tag-suggestion'` -> `'self-test-tag-suggestion'`
- `'active-recall-tag-count'` -> `'self-test-tag-count'`
- `'active-recall-note-suggestion'` -> `'self-test-note-suggestion'`
- `'active-recall-note-name'` -> `'self-test-note-name'`
- `'active-recall-note-path'` -> `'self-test-note-path'`
- `'active-recall-depth-toggle'` -> `'self-test-depth-toggle'`
- `'active-recall-link-preview'` -> `'self-test-link-preview'`
- `'mod-cta active-recall-generate-btn'` -> `'mod-cta self-test-generate-btn'`
- `'active-recall-confirm-buttons'` -> `'self-test-confirm-buttons'`

**src/__tests__/sidebar.test.ts** (CSS class string assertions)
- `'active-recall-panel'` -> `'self-test-panel'`
- `'active-recall-tab-bar'` -> `'self-test-tab-bar'`
- `'active-recall-loading'` -> `'self-test-loading'` (3 occurrences)
- `'active-recall-trash-btn'` -> `'self-test-trash-btn'` (3 occurrences)
- Import: `ActiveRecallSidebarView` -> `SelfTestSidebarView`

**src/__tests__/generation.test.ts** (TypeScript type imports)
- `import type { ActiveRecallSettings }` -> `import type { SelfTestSettings }`
- Local variable type annotations: `ActiveRecallSettings` -> `SelfTestSettings` (3 occurrences)

**src/__mocks__/obsidian.ts** (comment strings only - low risk)
- Comment line 168: `"Minimal PluginSettingTab base class - allows ActiveRecallSettingTab to extend it"`
- Comment line 194: `"Minimal ItemView base class - allows ActiveRecallSidebarView to extend it"`
- These are comments and do not affect compilation or tests, but should be updated for accuracy

**styles.css** (CSS class names and keyframe name)
- All 23 class selectors with `.active-recall-*` prefix -> `.self-test-*`
- Keyframe reference `animation: active-recall-spin` -> `animation: self-test-spin`
- `@keyframes active-recall-spin` -> `@keyframes self-test-spin`

**README.md** - full rewrite (see README Content Architecture below)

### Anti-Patterns to Avoid
- **Partial rename commit:** Never split the rename across multiple commits. TypeScript will fail between commits.
- **Renaming VIEW_TYPE string but not command IDs:** The stored view type string in user's workspace.json becomes stale, but since this is a first public release (D-06), that's acceptable. What's not acceptable is forgetting the command ID rename - command IDs appear in hotkey assignments.
- **Renaming CSS classes in .ts but not in styles.css (or vice versa):** The CSS will apply but render nothing styled until both are in sync. Always rename the CSS definition and all .ts references together.

---

## README Content Architecture

The existing README was written for a single-provider, single-mode v1 plugin. The v2.0 README needs a restructure to cover three providers and four collection modes while remaining accessible to non-technical users (D-11).

### Required sections

**Title and intro (D-07)**
- Title: "Self Test"
- Intro: What the plugin does (generates self-testing questions from notes to support active recall) without listing all modes up front

**Installation (D-08)**
- Standard Obsidian community plugin install steps (Settings > Community Plugins > Browse)
- Provider pick-one: "Open Settings > Self Test, choose your AI provider, and paste your API key"
- Links for all three providers:
  - OpenAI: https://platform.openai.com/api-keys
  - Google Gemini: https://aistudio.google.com/apikey
  - Anthropic (Claude): https://console.anthropic.com/settings/keys

**How to use - organized by mode (D-09)**
Each mode gets its own subsection:

1. **Folder mode** - generates from all notes in a selected folder. Entry points: command palette ("Generate Self-Test for Current Folder"), right-click folder in file explorer, sidebar Folders tab. Output: `_self-test.md` in the folder.

2. **Tag mode** - generates from all vault notes sharing a tag. Entry points: command palette ("Generate Self-Test by Tag"), sidebar Tags tab. Output: `_self-tests/_self-test-{tag}.md`.

3. **Linked Notes mode** - generates from a root note plus all notes it links to (optionally depth 2). Entry points: command palette ("Generate Self-Test from Linked Notes"), sidebar Links tab. Output: `_self-tests/_self-test-{note-name}.md`.

4. **Single Note mode** - generates for one note. Entry points: command palette ("Generate Self-Test for Current Note"), right-click any note in file explorer. Output: `{note-name}_self-test.md` in the same folder.

**Why self-testing works (D-10 - Claude's discretion for improvement)**
- Keep existing citations (Roediger & Karpicke 2006, Dunlosky 2013, Karpicke & Blunt 2011, Huberman Lab)
- Opportunity to tighten prose: the existing section is good but the paragraph about the self-test file design is dense - can split into clearer points

**How is this different (D-10 - Claude's discretion)**
- Existing differentiation content is solid; update any remaining "AI Active Recall" mentions
- The final bridging sentence ("closes with neutral bridging sentence") established in Phase 06-03 should be preserved

### Existing README patterns to preserve (from Phase 05 decisions)
- Plain prose only - no screenshots, badges, or GIFs (D-12)
- API key setup in Installation (not a separate section)
- Entry points covered in How to use (all four entry types for each mode)

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Plugin ID uniqueness in store | Manual uniqueness check | GitHub bot auto-validates | The validate-plugin-entry.yml workflow in obsidianmd/obsidian-releases checks id uniqueness automatically |
| Version/tag matching | Manual cross-check | Bot validates on PR | Bot checks that manifest version and GitHub release tag match |
| CSS class rename tracking | Manual tracking | Grep audit (done above) | All 23 CSS classes, 2 keyframe references, and all .ts usages are enumerated in this research |

---

## Runtime State Inventory

This is a rename/release phase - runtime state audit required.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | `data.json` in each user's vault stores settings. The plugin's `loadData()` reads from this file. Key names are `provider`, `openai`, `gemini`, `anthropic`, etc. - none of these match `active-recall` or `ActiveRecall`. Safe. | None |
| Live service config | None - plugin has never been published. No external service registrations. | None |
| OS-registered state | The workspace.json in each vault stores the leaf type as a string. Currently `'active-recall-panel'` (the VIEW_TYPE constant). If any developer has this running in their vault, their sidebar leaf will detach after the rename. | Acceptable per D-06 (no public users) - document in release notes |
| Secrets/env vars | None in the codebase. Users' API keys are stored in Obsidian's data.json under `openai.apiKey`, `gemini.apiKey`, `anthropic.apiKey` - none affected by rename. | None |
| Build artifacts | `main.js` (compiled output) carries the old class names until rebuilt. `package-lock.json` references `"name": "obsidian-sample-plugin"`. | Rebuild after rename. package-lock.json will auto-update when running npm install or is updated by npm version |

**The canonical question:** After every file in the repo is updated, what runtime systems still have the old string cached, stored, or registered?
Answer: Only the workspace.json of any current developer/tester who has the sidebar open. Acceptable for first public release per D-06.

---

## Obsidian Store Submission - Complete Requirements

Source: obsidianmd/obsidian-releases PR template (verified via GitHub), DeepWiki extraction.

### community-plugins.json entry format
```json
{
  "id": "self-test",
  "name": "Self Test",
  "author": "Agustin Gabrielli",
  "description": "Generate self-testing questions from your notes using AI to practice active recall.",
  "repo": "agus-gabrielli/obsidian-active-recall"
}
```

**Critical constraint:** The `id`, `name`, and `description` fields must exactly match manifest.json values. The automated bot (`validate-plugin-entry.yml`) rejects PRs where they differ.

### manifest.json final state
```json
{
  "id": "self-test",
  "name": "Self Test",
  "version": "1.0.0",
  "minAppVersion": "0.15.0",
  "description": "Generate self-testing questions from your notes using AI to practice active recall.",
  "author": "Agustin Gabrielli",
  "authorUrl": "https://github.com/agus-gabrielli",
  "fundingUrl": "",
  "isDesktopOnly": true
}
```

Note: The `description` field in manifest.json must exactly match what goes in community-plugins.json. Keep it concise (~125 chars max).

### GitHub release requirements
- Tag: `1.0.0` (no `v` prefix - this matches D-15)
- Release title: `1.0.0`
- Assets attached to the release: `main.js`, `styles.css`, `manifest.json` (matches D-16)
- The existing 1.0.0 release (created in Phase 05-03) needs to be updated with the new assets after the rename and rebuild

### PR checklist (all items must be true before opening PR)
- [ ] Plugin is functional and tested (137 tests + manual UAT from Phase 11)
- [ ] Tested on macOS (developer's platform); isDesktopOnly: true covers absence of mobile testing
- [ ] GitHub release contains main.js, manifest.json, styles.css (no zip archives)
- [ ] Release tag matches manifest.json version exactly: `1.0.0`
- [ ] README describes plugin purpose and usage
- [ ] LICENSE file present (confirmed: exists in repo root)
- [ ] Attribution for any code from other plugins (the LICENSE is from Dynalist/Obsidian sample - this needs to be checked/updated)
- [ ] Developer policies read and plugin complies

### LICENSE note
The current LICENSE file is from the Obsidian sample plugin (Copyright Dynalist Inc. 2020-2025). This needs to be updated to reflect the actual author before submission. The license type (0-BSD) is fine and permissive, but the copyright holder should be corrected to "Agustin Gabrielli".

---

## Common Pitfalls

### Pitfall 1: VIEW_TYPE string rename orphans the sidebar
**What goes wrong:** After renaming `VIEW_TYPE_ACTIVE_RECALL = 'active-recall-panel'` to `VIEW_TYPE_SELF_TEST = 'self-test-panel'`, any vault that has the old leaf type stored in `workspace.json` will fail to restore the sidebar on next load.
**Why it happens:** Obsidian stores leaf types by string. The old string no longer matches any registered view type.
**How to avoid:** Per D-06, this is acceptable for a first public release. If this were an upgrade to an existing published plugin, a migration in `onload()` would be required to `detachLeavesOfType('active-recall-panel')` before registering the new type.
**Warning signs:** Sidebar doesn't open after plugin reload during testing - expected if workspace.json still has the old type.

### Pitfall 2: community-plugins.json description mismatch
**What goes wrong:** PR bot immediately rejects with a validation error if `description` in community-plugins.json differs by even one character from manifest.json.
**Why it happens:** The automated `validate-plugin-entry.yml` workflow does an exact string comparison.
**How to avoid:** Write description in manifest.json first, then copy it verbatim into community-plugins.json.
**Warning signs:** PR CI fails immediately after opening.

### Pitfall 3: Forgetting to rebuild before creating the GitHub release
**What goes wrong:** main.js attached to the release still contains old `ActiveRecall` class names and `active-recall-*` CSS class strings.
**Why it happens:** TypeScript sources are renamed but the compiled output is stale.
**How to avoid:** Run `npm run build` after the rename commit, before creating/updating the GitHub release.

### Pitfall 4: package-lock.json name mismatch
**What goes wrong:** After renaming `package.json` name field, `package-lock.json` still references `obsidian-sample-plugin`. This doesn't affect the Obsidian plugin store but it's inconsistent.
**Why it happens:** package-lock.json is auto-generated and not manually updated.
**How to avoid:** Run `npm install` (no new packages needed, just locks sync) after updating package.json, or update the name field in package-lock.json directly in the same commit.

### Pitfall 5: GitHub release tag already exists at 1.0.0
**What goes wrong:** Phase 05-03 created a 1.0.0 release. The new build (post-rename) needs to replace the release assets, not create a new release.
**Why it happens:** The version number is staying at 1.0.0 per D-13. There is only one valid release to target.
**How to avoid:** Update the existing 1.0.0 GitHub release: delete old assets, upload new main.js, styles.css, manifest.json.

---

## Code Examples

### community-plugins.json entry
```json
{
  "id": "self-test",
  "name": "Self Test",
  "author": "Agustin Gabrielli",
  "description": "Generate self-testing questions from your notes using AI to practice active recall.",
  "repo": "agus-gabrielli/obsidian-active-recall"
}
```
Source: Format verified from obsidianmd/obsidian-releases community-plugins.json last entries.

### manifest.json after rename
```json
{
  "id": "self-test",
  "name": "Self Test",
  "version": "1.0.0",
  "minAppVersion": "0.15.0",
  "description": "Generate self-testing questions from your notes using AI to practice active recall.",
  "author": "Agustin Gabrielli",
  "authorUrl": "https://github.com/agus-gabrielli",
  "fundingUrl": "",
  "isDesktopOnly": true
}
```

### Key rename mapping (TypeScript identifiers)
```
ActiveRecallPlugin        -> SelfTestPlugin
ActiveRecallSidebarView   -> SelfTestSidebarView
ActiveRecallSettings      -> SelfTestSettings
ActiveRecallSettingTab    -> SelfTestSettingTab
VIEW_TYPE_ACTIVE_RECALL   -> VIEW_TYPE_SELF_TEST
'active-recall-panel'     -> 'self-test-panel'      (VIEW_TYPE value + CSS root class)
'open-active-recall-panel'-> 'open-self-test-panel' (command id)
```

---

## Validation Architecture

nyquist_validation is enabled in .planning/config.json.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (via ts-jest) |
| Config file | jest.config.ts |
| Quick run command | `npx jest` |
| Full suite command | `npx jest` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DIST-03 | README content - provider links, mode descriptions | manual | Human review of README.md | N/A - documentation |
| DIST-04 | Store submission passes automated bot validation | manual | PR CI in obsidianmd/obsidian-releases | N/A - external system |

**DIST-03 and DIST-04 are not unit-testable.** DIST-03 requires a human to read and verify the README content. DIST-04 is verified by the Obsidian bot running `validate-plugin-entry.yml` on the submission PR. Neither warrants new test files.

The rename work (supporting DIST-04 by producing a clean build) is validated by:
- `npx jest` - all 137 tests must pass after rename (CSS class assertions in sidebar.test.ts will catch CSS rename mismatches)
- `npm run build` (tsc -noEmit + esbuild) - TypeScript compilation verifies all identifier renames are consistent

### Sampling Rate
- **Per task commit:** `npx jest`
- **Per wave merge:** `npx jest && npm run build`
- **Phase gate:** `npx jest && npm run build` green + human README review before store PR

### Wave 0 Gaps
None - existing test infrastructure covers all phase requirements.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Plugin review checklist at plugin-review.md (GitHub) | Plugin guidelines at docs.obsidian.md/Plugins/Releasing/ | 2024-2025 | Use current docs URL - the GitHub file redirects |
| Release tag with `v` prefix (v1.0.0) | Exact version match, no prefix (1.0.0) | Always been the requirement | Tag must be `1.0.0` not `v1.0.0` |

---

## Open Questions

1. **GitHub release update vs. new release**
   - What we know: Phase 05-03 created a 1.0.0 GitHub release. The version stays at 1.0.0 (D-13).
   - What's unclear: Does the planner create a new 1.0.0 release (replacing the old one), or upload new assets to the existing one? GitHub does not allow two releases with the same tag.
   - Recommendation: Update the existing 1.0.0 release. Delete the three old assets and upload the three new ones. The release tag and title stay `1.0.0`.

2. **LICENSE copyright holder**
   - What we know: Current LICENSE says "Copyright (C) 2020-2025 by Dynalist Inc." This is the Obsidian sample plugin's license.
   - What's unclear: Whether the Obsidian store review will flag this, and whether the author wants to replace it or keep 0-BSD with corrected attribution.
   - Recommendation: Update copyright to "Agustin Gabrielli" and current year. Keep 0-BSD license type.

3. **Ribbon icon for "Self Test" branding**
   - What we know: Currently `brain-circuit`. The CONTEXT.md notes this may be reconsidered (Claude's Discretion).
   - What's unclear: What icon better represents "self-testing" vs. AI brain processing.
   - Recommendation: `pencil`, `file-check`, or `check-square` are semantically closer to self-testing/examination. `brain-circuit` still works but has AI connotations more than study connotations. Planner should decide and document the choice.

---

## Sources

### Primary (HIGH confidence)
- obsidianmd/obsidian-releases GitHub repository (community-plugins.json format, PR template checklist) - verified via direct file fetch
- DeepWiki: obsidianmd/obsidian-releases/6.1-plugin-submission-guide - cross-verified entry format and bot validation behavior
- Direct source code grep audit (all TypeScript, CSS, JSON files) - HIGH confidence for rename scope

### Secondary (MEDIUM confidence)
- WebSearch: "obsidian community plugin submission requirements 2026" - confirmed current requirements location at docs.obsidian.md

### Tertiary (LOW confidence)
- docs.obsidian.md submission requirements page - dynamic JS rendering prevented full content extraction; cross-validated with DeepWiki and PR template

## Metadata

**Confidence breakdown:**
- Rename scope: HIGH - full grep audit against live source files
- Store submission format: HIGH - verified from actual community-plugins.json entries and PR template
- README content: HIGH - locked decisions in CONTEXT.md, existing Phase 05 patterns are clear
- LICENSE issue: MEDIUM - flagged from file inspection, store policy not verified against official docs

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (stable domain - store requirements change slowly)

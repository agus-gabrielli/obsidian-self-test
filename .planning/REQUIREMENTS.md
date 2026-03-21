# Requirements: Obsidian Active Recall Plugin

**Defined:** 2026-03-09
**Core Value:** Users can generate a structured self-test from any folder of notes in one click, turning passive note review into active recall practice.

## v1 Requirements

### Core Generation

- [x] **GEN-01**: User can collect all top-level `.md` files from a selected folder (non-recursive, excludes `_self-test.md` itself)
- [x] **GEN-02**: Plugin generates open-ended recall questions ordered from foundational to advanced
- [x] **GEN-03**: Questions are categorized into Conceptual, Relationships, and Application sections when content supports it; categories are omitted when content is too simple or narrow
- [x] **GEN-04**: Each question includes a collapsible hint using Obsidian callout syntax (`> [!hint]-`)
- [x] **GEN-05**: Each question includes a collapsible reference answer using Obsidian callout syntax (`> [!check]-`)
- [x] **GEN-06**: Plugin generates a brief text-based concept map before questions when content supports it
- [x] **GEN-07**: Output is written to `_self-test.md` in the selected folder; existing file is overwritten on regeneration without backup

### Context Window Management

- [x] **CTX-01**: Plugin estimates token count using `chars / 4` heuristic before constructing the API call
- [x] **CTX-02**: If all note content fits within the token budget, a single API call is made
- [x] **CTX-03**: If content exceeds the token budget, notes are split into batches; each batch generates partial questions; a synthesis call deduplicates, reorders, and produces the final unified output

### Settings

- [x] **SET-01**: User can configure LLM provider (OpenAI in v1; interface abstracted for future providers)
- [x] **SET-02**: User can enter and save their API key (masked password field) with a visible warning about Git exposure risk in the settings UI
- [x] **SET-03**: User can select the model (text input, defaults to `gpt-4o-mini`)
- [x] **SET-04**: User can select output language (dropdown or text; default: match notes)
- [x] **SET-05**: User can toggle hint generation on/off (default: on)
- [x] **SET-06**: User can toggle reference answer generation on/off (default: on)
- [x] **SET-07**: User can toggle concept map generation on/off (default: on)
- [x] **SET-08**: User can provide custom instructions appended to the LLM prompt (text area, optional)

### Commands & Entry Points

- [x] **CMD-01**: Command palette entry: "Generate Self-Test for Current Folder" - generates `_self-test.md` for the folder containing the active note
- [x] **CMD-02**: Command palette entry: "Open Active Recall Panel" - opens or focuses the sidebar panel
- [x] **CMD-03**: Folder context menu item: "Generate Self-Test" - available on right-click of any folder in the file explorer

### Sidebar Panel

- [x] **UI-01**: Sidebar panel (leaf view) lists all vault folders that already have a `_self-test.md`, showing folder name, last-generated date, and a Regenerate button
- [x] **UI-02**: Sidebar panel lists vault folders that do not have a `_self-test.md`, showing a Generate button

### Feedback

- [x] **FB-01**: Plugin shows a progress indicator during generation (status bar message or modal spinner); the user knows a long-running operation is in progress
- [x] **FB-02**: Plugin shows an actionable error message when an API call fails (wrong key, rate limit, network error, context exceeded); raw API error strings are not shown directly to users

### Distribution

- [x] **DIST-01**: `manifest.json` meets Obsidian community store requirements: plugin ID `ai-active-recall` (no `obsidian-` prefix), `minAppVersion` set appropriately, `isDesktopOnly` accurate
- [x] **DIST-02**: README covers installation steps and API key configuration

## v2.0 Requirements

### Providers

- [x] **PROV-01**: User can select LLM provider (OpenAI, Gemini, Claude) from a dropdown in settings
- [x] **PROV-02**: User can configure a separate API key for each provider (keys persist independently)
- [x] **PROV-03**: User can select from a curated model list per provider (with custom model option)
- [x] **PROV-04**: Plugin calls Gemini via Google AI Studio API (generativelanguage.googleapis.com) using requestUrl()
- [x] **PROV-05**: Plugin calls Claude via native Anthropic Messages API (api.anthropic.com) using requestUrl()
- [x] **PROV-06**: Error messages reference the active provider by name (e.g. "Gemini API key invalid")
- [x] **PROV-07**: Existing v1.0 users' OpenAI API key and model are migrated automatically on first v2.0 load

### Collection Modes

- [x] **COL-01**: User can generate a self-test from all notes sharing a specific tag via a tag picker modal
- [x] **COL-02**: Tag picker modal shows all vault tags with autocomplete/filtering
- [x] **COL-03**: Tag-based output goes to a `_self-tests/` folder (e.g. `_self-tests/_self-test-python-language.md`)
- [x] **COL-04**: User can generate a self-test from a root/MOC note plus all its directly linked notes (depth 1)
- [x] **COL-05**: User can optionally include depth-2 links (links of links) via a toggle in the picker
- [ ] **COL-06**: User can generate a self-test for a single note (context menu on files + command palette)
- [x] **COL-07**: Single-note output goes to the same folder as the source note (e.g. `my-note_self-test.md`)

### UI Updates

- [ ] **UI-03**: Sidebar supports all generation modes (folder, tag, linked notes, single note) with clear navigation
- [ ] **UI-04**: Sidebar shows tag-based and link-based self-tests alongside folder-based ones

### Distribution

- [ ] **DIST-03**: README updated with new provider setup instructions and collection mode usage
- [ ] **DIST-04**: Plugin passes Obsidian community store review and PR is submitted to obsidianmd/obsidian-releases

## Future Requirements

### Spaced Repetition

- **SR-01**: `_self-test.md` YAML frontmatter includes `last_review`, `next_review`, `review_count`, `review_interval_days` (reserved in v1 YAML but unpopulated)
- **SR-02**: Sidebar panel shows priority-ordered list of self-tests based on `next_review` date
- **SR-03**: Fixed-interval spaced repetition scheduling (1 -> 3 -> 7 -> 14 -> 30 days)

### Content Change Detection

- **STA-01**: Sidebar panel flags folders where notes have been modified after `_self-test.md` was last generated
- **STA-02**: Sidebar shows which specific notes changed since last generation

## Out of Scope

| Feature | Reason |
|---------|--------|
| Interactive quiz UI | Destroys portability contract; 3x implementation cost; conflicts with markdown-first identity |
| Auto-regeneration on note save | Surprise API charges; rate limiting; unpredictable behavior |
| Recursive folder scanning | Unpredictable token scope; users control depth via folder structure |
| Cloud sync of review progress | Requires backend infrastructure; violates local-first ethos |
| Bundled API key or free tier | Violates Obsidian store guidelines; creates cost liability |
| Automatic backup of previous self-tests | File management complexity; user renames manually; git handles versioning |
| Real-time streaming output | `requestUrl()` does not support streaming; non-streaming acceptable for v2 |
| OpenAI-compatible proxy for Gemini/Claude | Using native APIs instead for proper feature support |
| Custom OpenAI-compatible endpoint | Deferred to future - three major providers sufficient for v2.0 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| GEN-01 | Phase 3 | Complete |
| GEN-02 | Phase 3 | Complete |
| GEN-03 | Phase 3 | Complete |
| GEN-04 | Phase 3 | Complete |
| GEN-05 | Phase 3 | Complete |
| GEN-06 | Phase 3 | Complete |
| GEN-07 | Phase 3 | Complete |
| CTX-01 | Phase 3 | Complete |
| CTX-02 | Phase 3 | Complete |
| CTX-03 | Phase 3 | Complete |
| SET-01 | Phase 2 | Complete |
| SET-02 | Phase 2 | Complete |
| SET-03 | Phase 2 | Complete |
| SET-04 | Phase 2 | Complete |
| SET-05 | Phase 2 | Complete |
| SET-06 | Phase 2 | Complete |
| SET-07 | Phase 2 | Complete |
| SET-08 | Phase 2 | Complete |
| CMD-01 | Phase 3 | Complete |
| CMD-02 | Phase 4 | Complete |
| CMD-03 | Phase 4 | Complete |
| UI-01 | Phase 4 | Complete |
| UI-02 | Phase 4 | Complete |
| FB-01 | Phase 3 | Complete |
| FB-02 | Phase 3 | Complete |
| DIST-01 | Phase 1 | Complete |
| DIST-02 | Phase 5 | Complete |
| PROV-01 | Phase 7 | Complete |
| PROV-02 | Phase 7 | Complete |
| PROV-03 | Phase 7 | Complete |
| PROV-04 | Phase 8 | Complete |
| PROV-05 | Phase 8 | Complete |
| PROV-06 | Phase 8 | Complete |
| PROV-07 | Phase 7 | Complete |
| COL-01 | Phase 9 | Complete |
| COL-02 | Phase 9 | Complete |
| COL-03 | Phase 9 | Complete |
| COL-04 | Phase 9 | Complete |
| COL-05 | Phase 9 | Complete |
| COL-06 | Phase 9 | Pending |
| COL-07 | Phase 9 | Complete |
| UI-03 | Phase 10 | Pending |
| UI-04 | Phase 10 | Pending |
| DIST-03 | Phase 11 | Pending |
| DIST-04 | Phase 11 | Pending |

**Coverage:**
- v1 requirements: 27 total (all complete)
- v2.0 requirements: 17 total
- Mapped to phases: 44/44 (100%)
- Unmapped: 0

---
*Requirements defined: 2026-03-09*
*Last updated: 2026-03-21 after v2.0 roadmap (phases 7-11)*

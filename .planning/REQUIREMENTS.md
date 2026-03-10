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

- [x] **CMD-01**: Command palette entry: "Generate Self-Test for Current Folder" — generates `_self-test.md` for the folder containing the active note
- [ ] **CMD-02**: Command palette entry: "Open Active Recall Panel" — opens or focuses the sidebar panel
- [ ] **CMD-03**: Folder context menu item: "Generate Self-Test" — available on right-click of any folder in the file explorer

### Sidebar Panel

- [ ] **UI-01**: Sidebar panel (leaf view) lists all vault folders that already have a `_self-test.md`, showing folder name, last-generated date, and a Regenerate button
- [ ] **UI-02**: Sidebar panel lists vault folders that do not have a `_self-test.md`, showing a Generate button

### Feedback

- [x] **FB-01**: Plugin shows a progress indicator during generation (status bar message or modal spinner); the user knows a long-running operation is in progress
- [x] **FB-02**: Plugin shows an actionable error message when an API call fails (wrong key, rate limit, network error, context exceeded); raw API error strings are not shown directly to users

### Distribution

- [x] **DIST-01**: `manifest.json` meets Obsidian community store requirements: plugin ID `ai-active-recall` (no `obsidian-` prefix), `minAppVersion` set appropriately, `isDesktopOnly` accurate
- [ ] **DIST-02**: README covers installation steps and API key configuration

## v2 Requirements

### Spaced Repetition

- **SR-01**: `_self-test.md` YAML frontmatter includes `last_review`, `next_review`, `review_count`, `review_interval_days` (reserved in v1 YAML but unpopulated)
- **SR-02**: Sidebar panel shows priority-ordered list of self-tests based on `next_review` date
- **SR-03**: Fixed-interval spaced repetition scheduling (1 → 3 → 7 → 14 → 30 days)

### Content Change Detection

- **STA-01**: Sidebar panel flags folders where notes have been modified after `_self-test.md` was last generated
- **STA-02**: Sidebar shows which specific notes changed since last generation

### Alternative Providers

- **PROV-01**: User can configure Anthropic as LLM provider
- **PROV-02**: User can configure a custom OpenAI-compatible endpoint

### Alternative Collection Modes

- **COL-01**: User can generate a self-test from a single note (`my-note_self-test.md`)
- **COL-02**: User can generate a self-test from all notes with a given tag
- **COL-03**: User can generate a self-test from a root note and all its linked notes

## Out of Scope

| Feature | Reason |
|---------|--------|
| Interactive quiz UI | Destroys portability contract; 3x implementation cost; conflicts with markdown-first identity |
| Auto-regeneration on note save | Surprise API charges; rate limiting; unpredictable behavior |
| Recursive folder scanning | Unpredictable token scope; users control depth via folder structure |
| Cloud sync of review progress | Requires backend infrastructure; violates local-first ethos |
| Bundled API key or free tier | Violates Obsidian store guidelines; creates cost liability |
| Automatic backup of previous self-tests | File management complexity; user renames manually; git handles versioning |
| Real-time streaming output | `requestUrl()` does not support streaming; non-streaming acceptable for v1; desktop-only workaround deferred to v2 |

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
| CMD-02 | Phase 4 | Pending |
| CMD-03 | Phase 4 | Pending |
| UI-01 | Phase 4 | Pending |
| UI-02 | Phase 4 | Pending |
| FB-01 | Phase 3 | Complete |
| FB-02 | Phase 3 | Complete |
| DIST-01 | Phase 1 | Complete |
| DIST-02 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 27 total
- Mapped to phases: 27
- Unmapped: 0 - all requirements covered

---
*Requirements defined: 2026-03-09*
*Last updated: 2026-03-09 after roadmap creation*

# Phase 10: Sidebar Redesign - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

The sidebar presents all four generation modes (folder, tag, linked notes, single note) in a clear navigable structure, and shows tag-based and link-based self-tests alongside folder-based ones. Single-note mode is intentionally excluded from the sidebar - it is well-served by context menu and command palette.

</domain>

<decisions>
## Implementation Decisions

### Mode navigation
- **D-01:** Text-only tabs across the top of the sidebar: "Folders", "Tags", "Links" - three tabs, not four
- **D-02:** No Note tab - single-note self-tests are scattered across the vault and lack meaningful grouping; context menu and command palette are sufficient entry points
- **D-03:** Each tab swaps the panel content below; separate DOM subtrees per mode
- **D-04:** Plugin remembers the last active tab across Obsidian restarts (persisted in settings); defaults to Folders tab

### Fixed header
- **D-05:** A fixed header above the tabs with concise text introducing the sidebar (similar to current "Active Recall" header but subtitle updated to be mode-neutral)

### Self-test entry behavior (all modes)
- **D-06:** All self-test entries are clickable - clicking navigates to (opens) the self-test file in the editor
- **D-07:** Each entry shows: name, last-generated date, and a Regenerate button - consistent pattern across all three tabs
- **D-08:** Spinner replaces the Regenerate button during generation (existing pattern preserved)

### Folders tab
- **D-09:** Same layout as the current sidebar - "Generated" section with regenerate buttons, "Not generated" section with generate buttons
- **D-10:** Folder entries are clickable to open their `_self-test.md` file (new behavior per D-06)

### Tags tab
- **D-11:** Lists previously generated tag-based self-tests by scanning `_self-tests/tags/`
- **D-12:** "Generate for new tag" button at the top that opens the existing TagPickerModal
- **D-13:** Each tag entry shows the tag name, last-generated date, and Regenerate button

### Links tab
- **D-14:** Lists previously generated link-based self-tests by scanning `_self-tests/links/`
- **D-15:** "Generate from linked notes" button at the top that opens the existing LinkedNotesPickerModal
- **D-16:** Each link entry shows the root note name, last-generated date, and Regenerate button

### Auto-refresh
- **D-17:** After generation from any mode completes, the sidebar reflects the updated state without manual refresh (existing behavior extended to new tabs)

### Folders tab consistency (gap-closure from human-verify)
- **D-18:** Folders tab shows only generated folders (not "Not generated" section) - consistent with Tags/Links tabs
- **D-19:** "Generate for new folder" button at top of Folders tab opens a folder picker modal

### Generating state visibility (gap-closure from human-verify)
- **D-20:** When regenerating an existing tag/links entry, the spinner ("Generating...") must show on that entry
- **D-21:** When generating a NEW item (no self-test file yet), a placeholder entry with "Generating..." appears in the list immediately
- **D-22:** A prominent banner inside the sidebar panel (top of active tab) shows "Generating self-test..." during generation - more visible than the status bar indicator alone

### Auto-open sidebar (gap-closure from human-verify)
- **D-23:** When generating from command palette or context menu (not sidebar), the sidebar auto-opens and switches to the corresponding tab so the user sees the generation progress

### Claude's Discretion
- Tab styling and active state visual treatment
- Exact header subtitle text
- How to scan `_self-tests/tags/` and `_self-tests/links/` for existing self-tests
- Settings field name for persisted active tab
- How generating state is tracked for tag/links modes (extending or paralleling `generatingFolders`)
- CSS class naming for new tab elements
- Empty state text for tags/links panels when no self-tests exist yet
- Folder picker modal implementation (SuggestModal or FuzzySuggestModal over vault folders)
- Banner styling and animation

</decisions>

<specifics>
## Specific Ideas

No specific references - open to standard Obsidian sidebar patterns.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project context
- `.planning/PROJECT.md` - Core value, constraints, plugin identity
- `.planning/REQUIREMENTS.md` - UI-03 and UI-04 are this phase's requirements

### Prior phase context
- `.planning/phases/04-commands-and-sidebar/04-CONTEXT.md` - Original sidebar decisions (panel layout, folder scope, section design)
- `.planning/phases/09-flexible-note-collection/09-CONTEXT.md` - Collection mode decisions, output path conventions, frontmatter format

### Existing code to modify
- `src/sidebar.ts` - Current sidebar implementation (ActiveRecallSidebarView, getFolderStatuses, buildContextMenuHandler, buildActivateView)
- `src/main.ts` - Sidebar registration, vault listeners for auto-refresh, generation commands
- `src/collectors.ts` - Output path builders (buildTagOutputPath, buildLinksOutputPath), isSelfTestFile
- `src/generation.ts` - GenerationService with generatingFolders Set, CollectionSpec type
- `src/modals.ts` - TagPickerModal and LinkedNotesPickerModal (reused from sidebar buttons)
- `src/settings.ts` - Will need new field for persisted active tab
- `styles.css` - Current sidebar styles (all prefixed `active-recall-`)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `getFolderStatuses(app)` - Returns folder eligibility and self-test file status; reusable for Folders tab unchanged
- `getLastGeneratedDate(file)` - Formats mtime as locale date string; reusable across all tabs
- `TagPickerModal` and `LinkedNotesPickerModal` - Opened from sidebar "generate new" buttons
- `buildActivateView(app)` - Sidebar activation logic; unchanged
- `buildContextMenuHandler()` - Folder context menu; unchanged
- `generatingFolders` Set on GenerationService - Tracks in-progress folder generation; needs parallel tracking for tag/links modes
- `isSelfTestFile(file)` - Three-pattern check for self-test files; useful for vault scanning

### Established Patterns
- `contentEl.empty()` + `renderPanel()` for full re-render on refresh
- CSS class prefix `active-recall-` for all sidebar elements
- `generatingFolders` Set with try/finally for spinner state management
- Vault `create`/`delete` listeners on self-test file patterns for auto-refresh

### Integration Points
- `ActiveRecallSidebarView.renderPanel()` - Currently renders one flat list; needs to render tab bar + mode-specific content
- `ActiveRecallSidebarView.generateForFolder()` - Needs parallel methods for tag/links generation (or generalized)
- `GenerationService.generatingFolders` - Needs extension to track tag/links generation in-progress state
- `src/settings.ts` ActiveRecallSettings - Needs `activeTab` field for persistence
- `styles.css` - Needs tab bar styles added
- Vault listeners in `main.ts` - Already detect `_self-tests/` path changes; should trigger refresh for tags/links tabs

</code_context>

<deferred>
## Deferred Ideas

- Content change detection (flagging folders with modified notes since last generation) - future requirement STA-01/STA-02
- Spaced repetition priority ordering in sidebar - future requirement SR-02
- Single-note self-test listing in sidebar - intentionally excluded; revisit if user feedback demands it
- Trash icon for deleting self-tests from sidebar - backlog item 999.1
- Native FuzzySuggestModal for linked notes picker - backlog item 999.2

</deferred>

---

*Phase: 10-sidebar-redesign*
*Context gathered: 2026-03-25*

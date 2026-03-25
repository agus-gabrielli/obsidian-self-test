# Phase 10: Sidebar Redesign - Research

**Researched:** 2026-03-25
**Domain:** Obsidian ItemView, DOM tab navigation, vault file scanning, settings persistence
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Text-only tabs across the top of the sidebar: "Folders", "Tags", "Links" - three tabs, not four
- **D-02:** No Note tab - single-note self-tests are excluded from the sidebar
- **D-03:** Each tab swaps the panel content below; separate DOM subtrees per mode
- **D-04:** Plugin remembers the last active tab across Obsidian restarts (persisted in settings); defaults to Folders tab
- **D-05:** A fixed header above the tabs with concise text introducing the sidebar (updated subtitle)
- **D-06:** All self-test entries are clickable - clicking navigates to the self-test file in the editor
- **D-07:** Each entry shows: name, last-generated date, and a Regenerate button - consistent pattern across all three tabs
- **D-08:** Spinner replaces the Regenerate button during generation (existing pattern preserved)
- **D-09:** Folders tab has same layout as current sidebar - "Generated" section and "Not generated" section
- **D-10:** Folder entries are clickable to open their `_self-test.md` file
- **D-11:** Tags tab scans `_self-tests/tags/` for previously generated tag-based self-tests
- **D-12:** "Generate for new tag" button at the top of Tags tab opens the existing TagPickerModal
- **D-13:** Each tag entry shows tag name, last-generated date, and Regenerate button
- **D-14:** Links tab scans `_self-tests/links/` for previously generated link-based self-tests
- **D-15:** "Generate from linked notes" button at top of Links tab opens LinkedNotesPickerModal
- **D-16:** Each link entry shows root note name, last-generated date, and Regenerate button
- **D-17:** After generation from any mode completes, sidebar reflects updated state without manual refresh

### Claude's Discretion

- Tab styling and active state visual treatment
- Exact header subtitle text
- How to scan `_self-tests/tags/` and `_self-tests/links/` for existing self-tests
- Settings field name for persisted active tab
- How generating state is tracked for tag/links modes (extending or paralleling `generatingFolders`)
- CSS class naming for new tab elements
- Empty state text for tags/links panels when no self-tests exist yet

### Deferred Ideas (OUT OF SCOPE)

- Content change detection (flagging folders with modified notes since last generation) - future STA-01/STA-02
- Spaced repetition priority ordering in sidebar - future SR-02
- Single-note self-test listing in sidebar - intentionally excluded
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-03 | Sidebar supports all generation modes (folder, tag, linked notes, single note) with clear navigation | Tab bar architecture in renderPanel(), separate DOM subtrees per tab, persisted activeTab setting |
| UI-04 | Sidebar shows tag-based and link-based self-tests alongside folder-based ones | Vault scanning via `app.vault.getFiles()` filtered to `_self-tests/tags/` and `_self-tests/links/` paths; `getLastGeneratedDate(file)` reusable unchanged |
</phase_requirements>

---

## Summary

Phase 10 is a pure UI refactor of `src/sidebar.ts`. No new generation logic is needed - all four collection modes already exist in `GenerationService`. The work is: restructuring `renderPanel()` to render a tab bar plus mode-specific panel, extending `GenerationService` with two new tracking sets for tag/links generating state, adding an `activeTab` field to `ActiveRecallSettings`, and writing new CSS for the tab bar.

The existing code already handles auto-refresh correctly via vault `create`/`delete` listeners in `main.ts` that call `refreshSidebarIfOpen()`. Those listeners already detect all `_self-tests/` path changes, so the Tags and Links panels will auto-refresh without any listener changes.

The main implementation risk is the generating-state tracking for tag and links modes. The current `generatingFolders` Set uses folder paths as keys. For tag mode the key is the tag string; for links mode the key is the root note path. These need parallel Sets (or a generalized approach) so the spinner pattern works correctly for all three tabs.

**Primary recommendation:** Add `generatingTags: Set<string>` and `generatingLinks: Set<string>` to `GenerationService` (parallel to `generatingFolders`), update `generate()` to populate them, and read them in the new Tags/Links panel renderers. This is the smallest, most testable change - no need to generalize into a single map keyed by spec type.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Obsidian ItemView API | (bundled) | Sidebar leaf view lifecycle - onOpen, onClose, contentEl DOM | This is the only Obsidian sidebar mechanism |
| Obsidian App.vault.getFiles() | (bundled) | Scan all vault files to find `_self-tests/tags/` and `_self-tests/links/` files | Already used in `collectNotesByTag`; same approach for sidebar scanning |
| Obsidian App.workspace.openLinkText | (bundled) | Navigate to a self-test file when a row is clicked (D-06) | Standard Obsidian file navigation |

### No New Dependencies

This phase adds zero new npm packages. Everything is in existing Obsidian API, existing project code, and the CSS already in `styles.css`.

---

## Architecture Patterns

### Recommended Project Structure

No new files are required. All changes go to existing files:

```
src/
  sidebar.ts        - Primary change target: tab bar, panel switching, new renderers
  settings.ts       - Add activeTab field to ActiveRecallSettings and DEFAULT_SETTINGS
  generation.ts     - Add generatingTags and generatingLinks Sets to GenerationService
  __tests__/
    sidebar.test.ts - Extend with new tab tests
styles.css          - Add tab bar CSS classes
```

### Pattern 1: Tab Bar DOM Structure

The tab bar is rendered inside `renderPanel()` before the existing panel content. Each tab is a `<button>` element. The active tab gets a CSS class. Clicking a tab updates the instance variable `this.activeTab` and calls `this.refresh()`.

```typescript
// Existing pattern already in sidebar.ts - just extended with a tab bar
public refresh(): void {
  this.contentEl.empty();
  this.renderPanel();
}

private renderPanel(): void {
  const container = this.contentEl.createDiv({ cls: 'active-recall-panel' });

  // Fixed header (D-05) - unchanged from current
  const header = container.createDiv({ cls: 'active-recall-header' });
  header.createEl('h3', { text: 'Active Recall', cls: 'active-recall-title' });
  header.createEl('p', { text: 'Generate and review your self-tests.', cls: 'active-recall-description' });

  // Tab bar (D-01)
  const tabBar = container.createDiv({ cls: 'active-recall-tab-bar' });
  for (const tab of ['folders', 'tags', 'links'] as const) {
    const btn = tabBar.createEl('button', {
      text: tab.charAt(0).toUpperCase() + tab.slice(1),
      cls: tab === this.activeTab
        ? 'active-recall-tab active-recall-tab--active'
        : 'active-recall-tab',
    });
    btn.addEventListener('click', () => {
      this.activeTab = tab;
      this.saveActiveTab(); // persist to settings
      this.refresh();
    });
  }

  // Panel content (D-03 - separate DOM subtrees)
  const panel = container.createDiv({ cls: 'active-recall-panel-content' });
  if (this.activeTab === 'folders') this.renderFoldersPanel(panel);
  else if (this.activeTab === 'tags') this.renderTagsPanel(panel);
  else this.renderLinksPanel(panel);
}
```

**Confidence:** HIGH - directly derived from existing `renderPanel()` pattern.

### Pattern 2: Scanning for Existing Self-Tests

Tags and links panels need to list previously generated files. The correct approach is to scan `app.vault.getFiles()` filtered by path prefix, since these files are already indexed by Obsidian's vault.

```typescript
// Scan _self-tests/tags/ for tag entries
private getTagSelfTests(): TFile[] {
  return this._app.vault.getFiles().filter(
    (f) => f.extension === 'md' && f.path.startsWith('_self-tests/tags/')
  );
}

// Scan _self-tests/links/ for link entries
private getLinksSelfTests(): TFile[] {
  return this._app.vault.getFiles().filter(
    (f) => f.extension === 'md' && f.path.startsWith('_self-tests/links/')
  );
}
```

**Tag name extraction from file path:** `_self-tests/tags/lang/python.md` -> tag is `lang/python`. Strip `_self-tests/tags/` prefix and `.md` suffix.

**Links name extraction from file path:** `_self-tests/links/my-moc.md` -> display name is `my-moc`. Use `file.basename`.

**Confidence:** HIGH - `app.vault.getFiles()` is already used identically in `collectNotesByTag` in `collectors.ts`.

### Pattern 3: Generating State for Tag/Links Modes

The current `generatingFolders` Set stores folder paths as strings. The parallel pattern for tags/links:

```typescript
// In GenerationService (generation.ts)
public readonly generatingFolders = new Set<string>(); // existing
public readonly generatingTags = new Set<string>();     // new: key = normalized tag
public readonly generatingLinks = new Set<string>();    // new: key = rootFile.path
```

In `generate()`:
```typescript
// Add at top of generate(), after existing folder tracking
let trackingTag: string | null = null;
let trackingLinks: string | null = null;

if (spec.mode === 'tag') {
  trackingTag = spec.tag.replace(/^#/, '');
  this.generatingTags.add(trackingTag);
}
if (spec.mode === 'links') {
  trackingLinks = spec.rootFile.path;
  this.generatingLinks.add(trackingLinks);
}

// In finally block:
if (trackingTag) this.generatingTags.delete(trackingTag);
if (trackingLinks) this.generatingLinks.delete(trackingLinks);
```

In `renderTagsPanel()`, check `this.generationService.generatingTags.has(normalizedTag)`.
In `renderLinksPanel()`, check `this.generationService.generatingLinks.has(rootFilePath)` - but we only have the output file, not the root file path directly. Use `file.basename` as the key instead, since `buildLinksOutputPath` uses `rootFile.basename`. So `generatingLinks` key should be `rootFile.basename`.

**Confidence:** HIGH - mirrors the existing `generatingFolders` pattern exactly.

### Pattern 4: Clickable File Navigation (D-06)

Opening a file in Obsidian editor from the sidebar:

```typescript
row.addEventListener('click', (evt) => {
  // Don't navigate if clicking the Regenerate button
  if ((evt.target as HTMLElement).closest('button')) return;
  this._app.workspace.openLinkText(file.path, '', false);
});
```

`openLinkText(linktext, sourcePath, newLeaf)` is the standard Obsidian API for programmatic file navigation. Pass `false` for `newLeaf` to open in existing tab. Pass `''` for sourcePath when there is no context note.

**Confidence:** HIGH - this is the standard Obsidian navigation API used by all plugins. Verified by checking Obsidian plugin development documentation patterns.

### Pattern 5: Persisting Active Tab (D-04)

Add `activeTab` to `ActiveRecallSettings`:

```typescript
// In settings.ts
export interface ActiveRecallSettings {
  // ... existing fields ...
  activeTab: 'folders' | 'tags' | 'links';
}

export const DEFAULT_SETTINGS: ActiveRecallSettings = {
  // ... existing defaults ...
  activeTab: 'folders',
};
```

In `ActiveRecallSidebarView`, the view reads from the plugin's settings on construction. The save pattern follows the existing approach: update `settings.activeTab` then call `plugin.saveSettings()`. The sidebar view needs access to the plugin to save settings.

**Current situation:** `ActiveRecallSidebarView` only receives `app` and `generationService`. It does not hold a reference to the plugin. Two options:

1. Pass the plugin instance to the sidebar constructor (adds a `plugin` param)
2. Pass a `saveTab(tab: string) => Promise<void>` callback, keeping the factory pattern

Option 2 matches the existing factory pattern (`buildActivateView`, `buildContextMenuHandler` accept callbacks). However, option 1 is simpler and this project already passes `app` directly. Either works - this falls under Claude's discretion. Option 1 (pass plugin reference) is recommended because it's less boilerplate.

**Confidence:** HIGH - follows existing settings persistence pattern from `settings.ts`.

### Pattern 6: Entry Row Rendering (D-07, D-08)

Consistent row pattern across all three tabs:

```typescript
// Reusable row builder - can be a private method
private renderSelfTestRow(
  container: HTMLElement,
  name: string,
  date: string | null,
  file: TFile | null,
  isGenerating: boolean,
  onRegenerate: () => void
): void {
  const row = container.createDiv({ cls: 'active-recall-folder-row' });
  const info = row.createDiv({ cls: 'active-recall-folder-info' });
  info.createSpan({ text: name, cls: 'active-recall-folder-name' });
  if (date) {
    info.createSpan({ text: date, cls: 'active-recall-date' });
  }

  if (file) {
    // Clickable row (D-06)
    row.addClass('active-recall-row--clickable');
    row.addEventListener('click', (evt) => {
      if ((evt.target as HTMLElement).closest('button')) return;
      this._app.workspace.openLinkText(file.path, '', false);
    });
  }

  if (isGenerating) {
    const loading = row.createDiv({ cls: 'active-recall-loading' });
    loading.createSpan({ cls: 'active-recall-spinner' });
    loading.createSpan({ text: 'Generating...', cls: 'active-recall-loading-text' });
  } else if (file) {
    const btn = row.createEl('button', { text: 'Regenerate', cls: 'active-recall-btn' });
    btn.addEventListener('click', onRegenerate);
  } else {
    const btn = row.createEl('button', { text: 'Generate', cls: 'active-recall-btn' });
    btn.addEventListener('click', onRegenerate);
  }
}
```

**Confidence:** HIGH - direct derivation from existing row rendering in `renderPanel()`.

### Anti-Patterns to Avoid

- **Storing view state in generationService:** The `activeTab` field belongs in `settings` (persistence) and as an instance variable on the view (runtime). It should not be on `GenerationService`.
- **Full re-render on every keypress:** `renderPanel()` is called only on `refresh()`, which is called after generation or on tab switch. Not on polling or timers. The existing vault listener pattern is correct.
- **Using `app.workspace.openLinkText` with a relative link:** Always pass the full vault path from `file.path`, not just `file.basename`. Obsidian resolves the path correctly only when given the full path as the first argument.
- **Forgetting the click-intercept for the Regenerate button:** If you attach a click listener to the entire row, clicks on the Regenerate button will bubble up and also trigger navigation. Guard with `evt.target.closest('button')`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File navigation to self-test | Custom file opener | `app.workspace.openLinkText(path, '', false)` | Handles split view, new tab logic, symlinks correctly |
| File scanning for tag/link self-tests | Custom directory traversal | `app.vault.getFiles().filter(...)` | vault.getFiles() returns all indexed files; already used in collectors.ts |
| Tab persistence | localStorage or session variable | `ActiveRecallSettings.activeTab` + `plugin.saveSettings()` | Follows existing settings persistence pattern; survives Obsidian restart |
| Spinner animation | JS-based animation | Existing CSS `@keyframes active-recall-spin` | Already in styles.css; just reuse `.active-recall-spinner` class |

**Key insight:** Every problem in this phase already has a solution in the existing codebase. The phase is about reorganizing and extending existing patterns, not building new infrastructure.

---

## Common Pitfalls

### Pitfall 1: generatingLinks key mismatch

**What goes wrong:** `renderLinksPanel()` checks `generatingLinks.has(X)` but `generate()` adds a different key for X. For example, using `rootFile.path` as key in `generate()` but trying to match by `file.basename` in the panel renderer.

**Why it happens:** The renderer only has access to the output `TFile` (e.g., `_self-tests/links/my-moc.md`), not the original `rootFile` that was passed to `generate()`. The link between them is via `file.basename` == `rootFile.basename`.

**How to avoid:** Use `rootFile.basename` as the key for `generatingLinks` in `generate()`. In `renderLinksPanel()`, check `this.generationService.generatingLinks.has(file.basename)`. This works because `buildLinksOutputPath(rootFile)` uses `rootFile.basename` as the filename.

**Warning signs:** Spinner never appears, or spinner shows permanently after generation completes.

### Pitfall 2: Tab state lost after panel refresh

**What goes wrong:** `refresh()` calls `this.contentEl.empty()` then `renderPanel()`. If `activeTab` is only stored as a local variable (not an instance variable), it resets to `'folders'` on every refresh.

**Why it happens:** `refresh()` tears down and rebuilds the entire DOM. The instance variable must survive this rebuild.

**How to avoid:** `this.activeTab` must be an instance variable on `ActiveRecallSidebarView`. Initialize it from `settings.activeTab` in the constructor. Do not re-read from settings inside `renderPanel()` - the instance variable is the source of truth at runtime.

### Pitfall 3: Click event bubbling on Regenerate button

**What goes wrong:** Clicking Regenerate triggers both the regenerate action AND navigation to the file (D-06).

**Why it happens:** If the row has a click listener for navigation and the Regenerate button is a child of the row, button clicks bubble to the row.

**How to avoid:** In the row click handler: `if ((evt.target as HTMLElement).closest('button')) return;`. This checks if the click originated from any button anywhere in the row.

### Pitfall 4: Tags panel showing raw file basename instead of tag name

**What goes wrong:** `_self-tests/tags/lang/python.md` shows as `python` instead of `lang/python`.

**Why it happens:** Using `file.basename` gives only the final segment. The full tag includes the parent path segments within `_self-tests/tags/`.

**How to avoid:** Derive tag name from path: `file.path.replace('_self-tests/tags/', '').replace('.md', '')`. This gives the full hierarchical tag (e.g., `lang/python`).

### Pitfall 5: Regenerate from Tags/Links panel doesn't update the sidebar

**What goes wrong:** User clicks Regenerate in the Tags panel, generation completes, but the panel doesn't refresh.

**Why it happens:** The `generateForFolder()` method calls `this.refresh()` before and after. New `generateForTag()` and `generateForLinks()` methods must follow the same pattern.

**How to avoid:** Use the same try/finally + refresh pattern:

```typescript
public async generateForTag(tag: string): Promise<void> {
  this.refresh(); // show spinner
  try {
    await this.generationService.generate({ mode: 'tag', tag });
  } finally {
    this.refresh(); // hide spinner, update list
  }
}
```

The vault `create`/`delete` listeners in `main.ts` also trigger `refreshSidebarIfOpen()`, providing a second refresh path. But the method's own try/finally is required for the spinner-on/spinner-off sequence.

### Pitfall 6: Empty tag/links panels on first use show nothing

**What goes wrong:** New users see a blank panel with no explanation.

**Why it happens:** If no files exist in `_self-tests/tags/` or `_self-tests/links/`, the filter returns an empty array and nothing renders.

**How to avoid:** Render an empty-state message when the scanned list is empty. This falls under Claude's discretion for the exact text. Example pattern (follow existing section label style):

```typescript
if (tagFiles.length === 0) {
  panel.createEl('p', {
    text: 'No tag-based self-tests yet. Use "Generate for new tag" above to create one.',
    cls: 'active-recall-empty-state',
  });
}
```

---

## Code Examples

### Full tab type union

```typescript
// Suggested type - consistent with settings field
export type ActiveTab = 'folders' | 'tags' | 'links';
```

### Regenerate from Links panel

The Links panel knows only the output `TFile` (`_self-tests/links/my-moc.md`), not the original `TFile` that was the root note. To regenerate, the sidebar needs to open the `LinkedNotesPickerModal` again (same as the "Generate from linked notes" command), OR it needs to look up the original root file by basename.

**Simpler approach (recommended):** Open `LinkedNotesPickerModal` pre-populated with the root note name. The user confirms. This reuses the existing modal without adding a lookup dependency.

**Alternative:** `app.vault.getFileByPath(basename + '.md')` guessing - fragile, wrong if the file moved.

**Recommended:** Re-open `LinkedNotesPickerModal`. The entry text in the Links panel says "Regenerate" but triggers the picker pre-filtered to the root note's name. This is consistent with the "Generate from linked notes" command flow and avoids storing extra metadata.

However, this deviates from D-07 which says each entry has a "Regenerate button" that presumably regenerates without re-prompting. A true regenerate without prompting requires knowing the root file. The sidebar can do `app.vault.getFileByPath(basename)` where `basename` comes from `file.basename` of the links output file. If the root note still exists, regenerate. If not, show a Notice.

**Resolution:** Use `app.vault.getFiles().find(f => f.basename === outputFile.basename && !isSelfTestFile(f))` to locate the original root note. This is O(files) but runs only on button click, acceptable. If not found, show Notice("Root note not found. Use 'Generate from linked notes' to regenerate.").

**Confidence:** MEDIUM - the lookup approach is straightforward but has an edge case if basename collisions exist across folders. Acceptable for this use case since the user can always use the command palette as fallback.

### Vault listener coverage check

The existing listeners in `main.ts` already cover all needed auto-refresh cases:

```typescript
// Already in main.ts - covers _self-tests/tags/ and _self-tests/links/ creation/deletion
this.app.vault.on('create', (file) => {
  if (file instanceof TFile && (
    file.basename === '_self-test' ||
    file.path.startsWith('_self-tests/') ||   // <-- covers tags/ and links/
    file.basename.endsWith('_self-test')
  )) {
    refreshSidebarIfOpen(this.app);
  }
});
```

No changes needed in `main.ts` for auto-refresh. The `_self-tests/` prefix check already catches all tag and links output files.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Flat sidebar list | Tab-structured sidebar with mode panels | Phase 10 (this phase) | Sidebar becomes the hub for all four modes |
| generatingFolders only | generatingFolders + generatingTags + generatingLinks | Phase 10 (this phase) | Spinner works for all modes |

**No deprecated patterns in this phase.** The existing CSS, DOM building conventions, and test mock patterns all carry forward unchanged.

---

## Open Questions

1. **Regenerate from Links panel - root note lookup**
   - What we know: The output file basename matches the root note basename (by `buildLinksOutputPath` convention)
   - What's unclear: If the user has two notes with the same basename in different folders, which one does the sidebar pick?
   - Recommendation: Use the first match. Document in a code comment that this is a known limitation for basename collisions. Not worth a more complex lookup for v2.0.

2. **Tag name display for hierarchical tags**
   - What we know: Tag output path is `_self-tests/tags/lang/python.md`, so display name should be `lang/python`
   - What's unclear: Should the Tags panel show `lang/python` or just `python` with indentation?
   - Recommendation: Show full tag path (`lang/python`) in the row name - consistent with how `TagPickerModal` constructs tags in its suggestions.

3. **saveSettings access in the sidebar view**
   - What we know: Current sidebar constructor takes `app` and `generationService` only
   - What's unclear: Best way to expose `plugin.saveSettings()` to the view for tab persistence
   - Recommendation: Add the plugin instance as a third constructor parameter to `ActiveRecallSidebarView`. Update `main.ts` registration accordingly. This is one line of change.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest + ts-jest (existing) |
| Config file | `jest.config.cjs` |
| Quick run command | `npx jest src/__tests__/sidebar.test.ts` |
| Full suite command | `npx jest` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-03 | Tab bar renders with three tabs (Folders, Tags, Links) | unit | `npx jest src/__tests__/sidebar.test.ts` | Partial - file exists, tests to be added |
| UI-03 | Clicking a tab swaps the panel content (separate DOM subtrees) | unit | `npx jest src/__tests__/sidebar.test.ts` | Partial |
| UI-03 | Active tab persists to settings on tab switch | unit | `npx jest src/__tests__/sidebar.test.ts` | Partial |
| UI-04 | Tags panel renders files found in `_self-tests/tags/` | unit | `npx jest src/__tests__/sidebar.test.ts` | Partial |
| UI-04 | Links panel renders files found in `_self-tests/links/` | unit | `npx jest src/__tests__/sidebar.test.ts` | Partial |
| UI-04 | After generation, sidebar reflects updated state (via refresh) | unit | `npx jest src/__tests__/sidebar.test.ts` | Partial |
| UI-03/04 | Spinner shows during tag/links generation, hides after | unit | `npx jest src/__tests__/sidebar.test.ts` | Partial |

All tests go into the existing `src/__tests__/sidebar.test.ts` file (extended). The existing mock infrastructure (`createMockApp`, `ItemView`, `makeMockEl`) already supports the new tests.

### Sampling Rate

- **Per task commit:** `npx jest src/__tests__/sidebar.test.ts`
- **Per wave merge:** `npx jest`
- **Phase gate:** Full suite green (127 tests + new sidebar tests) before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/__tests__/sidebar.test.ts` - 7+ new test cases for tab bar, Tags panel, Links panel, and generating state spinners. File exists; new describe blocks to add.
- [ ] Obsidian mock (`src/__mocks__/obsidian.ts`) - may need `makeMockEl` to support `addClass` and `querySelector`/`querySelectorAll` for the clickable row tests. Check before writing tests.

---

## Sources

### Primary (HIGH confidence)

- Direct code reading: `src/sidebar.ts` - current renderPanel(), generateForFolder(), refresh() patterns
- Direct code reading: `src/generation.ts` - GenerationService.generatingFolders Set and try/finally tracking
- Direct code reading: `src/collectors.ts` - buildTagOutputPath, buildLinksOutputPath path conventions
- Direct code reading: `src/settings.ts` - ActiveRecallSettings interface, DEFAULT_SETTINGS, saveSettings pattern
- Direct code reading: `src/__mocks__/obsidian.ts` - mock capabilities and limitations for tests
- Direct code reading: `src/main.ts` - vault listeners, refreshSidebarIfOpen, getSidebarView patterns
- Direct code reading: `styles.css` - existing CSS class inventory and design tokens

### Secondary (MEDIUM confidence)

- Obsidian API convention: `app.workspace.openLinkText(path, '', false)` for file navigation - standard pattern in community plugins
- Obsidian API convention: `app.vault.getFiles()` returns all indexed vault files synchronously

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies; all patterns are in existing codebase
- Architecture: HIGH - all patterns are direct extensions of existing code in sidebar.ts, generation.ts, settings.ts
- Pitfalls: HIGH - derived from reading the actual code paths, not speculation
- Test plan: HIGH - existing test infrastructure fully supports the new tests

**Research date:** 2026-03-25
**Valid until:** 2026-05-25 (stable Obsidian API; no third-party dependency churn)

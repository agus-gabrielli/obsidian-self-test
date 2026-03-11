# Phase 4: Commands and Sidebar - Research

**Researched:** 2026-03-11
**Domain:** Obsidian Plugin API - ItemView, workspace events, vault traversal, frontmatter cache
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Sidebar folder scope**
- Show only folders that contain at least one `.md` file - auto-filters .obsidian, Attachments, media folders without a hardcoded exclusion list
- Each folder listed independently: `StudyNotes/` and `StudyNotes/Week1/` both appear as separate rows if they each have .md files
- Vault root excluded (files directly under the vault root, no parent folder)

**Panel layout**
- Two sections: "Self-tests" (folders that have `_self-test.md`) at top, "No self-test" (folders without) below
- Full path shown for each folder (e.g., "StudyNotes/Week1") to avoid ambiguity when subfolder names repeat
- Empty sections are hidden entirely - no section header shown if nothing belongs in it (common on first use when no self-tests exist yet)
- Folders with a self-test show: full path, last-generated date, and a Regenerate button
- Folders without a self-test show: full path and a Generate button

**Ribbon icon**
- Add a ribbon icon to open/focus the Active Recall panel
- Users can right-click and hide it in Obsidian if they don't want it

**Context menu**
- "Generate Self-Test" appears on all folders in the file explorer - no filtering (not worth maintaining an exclusion list)
- Uses the right-clicked folder path directly - no confirmation step before generating
- Feedback pattern unchanged from Phase 3: status bar + Notice popup on completion/error

### Claude's Discretion
- Which Lucide icon to use for the ribbon
- Exact section header text ("Self-tests" vs "Generated" etc.)
- How to detect/read the last-generated date from `_self-test.md` frontmatter (parse YAML or use file mtime)
- How auto-refresh is implemented after generation (event emitter, callback, or polling)
- ItemView implementation details (leaf type, icon, display text)

### Deferred Ideas (OUT OF SCOPE)

None - discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CMD-02 | Command palette: "Open Active Recall Panel" - opens or focuses the sidebar panel | `activateView()` pattern using `getLeavesOfType` + `getRightLeaf` + `revealLeaf` |
| CMD-03 | Folder context menu: "Generate Self-Test" - on right-click of any folder in file explorer | `workspace.on('file-menu')` + `TFolder` instanceof check + `menu.addItem()` |
| UI-01 | Sidebar panel lists folders with `_self-test.md`: folder path, last-generated date, Regenerate button | `ItemView`, `metadataCache.getFileCache()`, `TFile.stat.mtime`, `vault.getAllFolders()` |
| UI-02 | Sidebar panel lists folders without `_self-test.md`: folder path, Generate button | Same as UI-01; absence check via `getAbstractFileByPath()` |
</phase_requirements>

---

## Summary

Phase 4 wires up the remaining three entry points (CMD-02, CMD-03, ribbon) and implements the sidebar panel (UI-01, UI-02). The generation logic is entirely complete in `GenerationService`; this phase is purely about Obsidian UI surfaces. All three new surfaces call `generationService.generate(folderPath)` identically to CMD-01.

The Obsidian plugin API provides first-class support for every feature in scope. `ItemView` is the standard base class for sidebar panels (used by Obsidian's own core panels). The `workspace.on('file-menu')` event fires on right-click of any file or folder in the file explorer. `vault.getAllFolders()` efficiently lists all vault folders. `metadataCache.getFileCache(file).frontmatter` gives zero-parse access to YAML frontmatter values. All of these APIs have been stable since Obsidian 0.9.7-0.15.0 and are well within the plugin's `minAppVersion: 0.15.0`.

The main subtlety is the sidebar refresh: after `GenerationService.generate()` resolves, the sidebar's `ItemView` must re-render. The cleanest pattern is to pass a refresh callback into `GenerationService` callers after generation, or to use a custom event dispatched on the `app.workspace` object. The callback pattern is simpler and avoids adding event infrastructure.

**Primary recommendation:** Implement `sidebar.ts` as an `ItemView` subclass, expose a `refresh()` method on it, and pass that method as a post-generation callback from each of the three new entry points.

---

## Standard Stack

### Core

| API / Class | Available Since | Purpose | Why Standard |
|-------------|-----------------|---------|--------------|
| `ItemView` (obsidian) | 0.9.7 | Base class for custom sidebar panels | The only official way to add a persistent sidebar pane |
| `workspace.on('file-menu', ...)` | 0.9.7 | Folder/file context menu injection | Official event - unregistered automatically on plugin unload via `registerEvent` |
| `vault.getAllFolders(includeRoot?)` | ~1.0 (confirmed in installed package) | List all TFolder objects in vault | Eliminates manual tree traversal |
| `metadataCache.getFileCache(file).frontmatter` | 0.9.7 | Read YAML frontmatter without file I/O | Synchronous, cached; no `await` needed |
| `TFile.stat.mtime` | 0.9.7 | File modification timestamp (unix ms) | Fallback when frontmatter field is null |
| `workspace.getLeavesOfType(viewType)` | 0.9.7 | Find existing leaf before opening new one | Prevents duplicate sidebar panes |
| `workspace.getRightLeaf(false)` | 0.9.7 | Get or create a right-sidebar leaf | Standard pattern for right-panel views |
| `workspace.revealLeaf(leaf)` | 0.9.7 (sync) / 1.7.2 (async) | Bring leaf to foreground, uncollapse sidebar | Required after setViewState |
| `workspace.detachLeavesOfType(viewType)` | 0.9.7 | Remove all leaves of a view type on unload | Called in `onunload()` to prevent ghost panes |
| `addRibbonIcon(icon, title, cb)` | 0.9.7 | Register a ribbon button | Standard plugin ribbon pattern |

### Supporting

| API | Purpose | When to Use |
|-----|---------|-------------|
| `app.workspace.onLayoutReady(cb)` | Defer view registration until workspace is initialized | Wrap `activateView` call in `onload` if opening on startup |
| `getIconIds()` | List all available Lucide icon names at runtime | Only needed for debugging icon name validity |
| `contentEl` | Safe reference to the ItemView's content area | Always use over `containerEl.children[1]` (unstable) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `metadataCache.getFileCache().frontmatter` | `app.vault.read()` + manual YAML parse | Cache is synchronous and already parsed; reading file is async and adds I/O |
| `TFile.stat.mtime` as fallback | Parse `last_review` from frontmatter | `last_review` is `null` in the v1 frontmatter template; mtime is always populated |
| Callback for refresh | `app.workspace.trigger('active-recall:refreshed')` custom event | Custom event is cleaner for multiple listeners but adds indirection; callback is simpler for a single consumer |
| `getLeavesOfType` check before open | `detachLeavesOfType` then always re-open | Detach/re-open destroys scroll state; check-and-focus is the better UX |

**Installation:** No new packages needed. Everything is in the `obsidian` package already installed.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── main.ts          # onload: register view, commands, ribbon, context menu event
├── sidebar.ts       # ActiveRecallSidebarView extends ItemView
├── generation.ts    # (existing) GenerationService - unchanged
└── settings.ts      # (existing) - unchanged
```

### Pattern 1: ItemView Registration and Activation (No Duplicate Panes)

**What:** Register the view type once in `onload()`, detach in `onunload()`, and use `getLeavesOfType` to focus existing leaf before creating a new one.

**When to use:** Any custom sidebar panel.

```typescript
// Source: marcusolsson.github.io/obsidian-plugin-docs/user-interface/views
// Confirmed against obsidian.d.ts in installed package

export const VIEW_TYPE_ACTIVE_RECALL = 'active-recall-panel';

// In main.ts onload():
this.registerView(
    VIEW_TYPE_ACTIVE_RECALL,
    (leaf) => new ActiveRecallSidebarView(leaf, this.app, generationService)
);

// In main.ts onunload():
this.app.workspace.detachLeavesOfType(VIEW_TYPE_ACTIVE_RECALL);

// activateView helper - call from CMD-02 and ribbon icon:
async activateView() {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_ACTIVE_RECALL);
    if (existing.length > 0) {
        await this.app.workspace.revealLeaf(existing[0]);
        return;
    }
    const leaf = this.app.workspace.getRightLeaf(false);
    if (leaf) {
        await leaf.setViewState({ type: VIEW_TYPE_ACTIVE_RECALL, active: true });
        await this.app.workspace.revealLeaf(leaf);
    }
}
```

**Note on `revealLeaf`:** The async form (awaitable) is documented `@since 1.7.2`. The function exists in earlier versions but returns void. Since `minAppVersion` is `0.15.0`, `await` will still work (Promise resolves on undefined). No breakage, but the await is a nice-to-have for ensuring fully-loaded state.

### Pattern 2: Folder Context Menu

**What:** Register a `file-menu` event listener that checks for `TFolder` and adds a menu item.

**When to use:** Any folder-specific context menu action.

```typescript
// Source: Confirmed against obsidian.d.ts - workspace.on('file-menu') signature:
// on(name: 'file-menu', callback: (menu: Menu, file: TAbstractFile, source: string, leaf?: WorkspaceLeaf) => any)

this.registerEvent(
    this.app.workspace.on('file-menu', (menu, file) => {
        if (!(file instanceof TFolder)) return;
        menu.addItem((item) => {
            item
                .setTitle('Generate Self-Test')
                .setIcon('brain-circuit')  // or 'book-open-check' - see Icon Recommendation below
                .onClick(async () => {
                    await generationService.generate(file.path);
                    // refresh sidebar if open
                    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_ACTIVE_RECALL);
                    if (leaves.length > 0) {
                        (leaves[0].view as ActiveRecallSidebarView).refresh();
                    }
                });
        });
    })
);
```

**Critical:** `TFolder` must be imported from `obsidian`. The check `file instanceof TFolder` filters out file right-clicks (the same event fires for both).

### Pattern 3: Vault Folder Enumeration for Sidebar

**What:** Use `vault.getAllFolders()` then filter to folders containing at least one `.md` file.

```typescript
// Source: obsidian.d.ts line 6332: getAllFolders(includeRoot?: boolean): TFolder[]
// Pass false to exclude vault root (matching user constraint)

function getEligibleFolders(app: App): TFolder[] {
    return app.vault.getAllFolders(false).filter((folder) =>
        folder.children.some(
            (child) => child instanceof TFile && child.extension === 'md'
        )
    );
}
```

### Pattern 4: Reading Last-Generated Date

**What:** Use `metadataCache.getFileCache()` to read `last_review` frontmatter; fall back to `TFile.stat.mtime`.

**Recommendation (Claude's Discretion):** Use `TFile.stat.mtime` as the primary source for "last generated" display. The YAML `last_review` field exists in the frontmatter template but is always written as `null` in Phase 3's `generate()` output - it is reserved for v2 spaced repetition. `stat.mtime` is always accurate since `writeOutput` overwrites the file on each generation.

```typescript
// Source: obsidian.d.ts - TFile.stat: FileStats { mtime: number }
// mtime is unix timestamp in milliseconds

function getLastGeneratedDate(app: App, selfTestFile: TFile): string {
    return new Date(selfTestFile.stat.mtime).toLocaleDateString();
}
```

**Alternative:** Read `frontmatter.last_review` via `metadataCache.getFileCache(file)?.frontmatter?.last_review`. This is also valid and synchronous, but returns `null` until v2 populates it. Stick with mtime.

### Pattern 5: Auto-Refresh After Generation

**Recommendation (Claude's Discretion):** Pass a refresh callback to each generation call site.

```typescript
// In sidebar.ts - expose a refresh() method:
export class ActiveRecallSidebarView extends ItemView {
    // ...
    refresh(): void {
        this.contentEl.empty();
        this.renderPanel();
    }
}

// In each entry point (CMD-02 callback, ribbon, context menu):
await generationService.generate(folderPath);
const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_ACTIVE_RECALL);
if (leaves.length > 0) {
    (leaves[0].view as ActiveRecallSidebarView).refresh();
}
```

This avoids adding any event infrastructure. The cast is safe because only `ActiveRecallSidebarView` instances are registered under `VIEW_TYPE_ACTIVE_RECALL`.

### Pattern 6: ItemView Rendering (contentEl, not innerHTML)

**What:** Use Obsidian's DOM builder API (`createEl`, `createDiv`) instead of `innerHTML` for secure, idiomatic rendering.

```typescript
async onOpen(): Promise<void> {
    this.renderPanel();
}

private renderPanel(): void {
    const container = this.contentEl;
    container.empty();

    const withSelfTest = /* folders that have _self-test.md */;
    const withoutSelfTest = /* folders that don't */;

    if (withSelfTest.length > 0) {
        container.createEl('h4', { text: 'Self-tests' });
        for (const { folder, file } of withSelfTest) {
            const row = container.createDiv();
            row.createSpan({ text: folder.path });
            row.createSpan({ text: getLastGeneratedDate(this.app, file), cls: 'active-recall-date' });
            const btn = row.createEl('button', { text: 'Regenerate' });
            btn.onclick = () => this.onGenerate(folder.path);
        }
    }

    if (withoutSelfTest.length > 0) {
        container.createEl('h4', { text: 'No self-test' });
        for (const folder of withoutSelfTest) {
            const row = container.createDiv();
            row.createSpan({ text: folder.path });
            const btn = row.createEl('button', { text: 'Generate' });
            btn.onclick = () => this.onGenerate(folder.path);
        }
    }
}
```

**Empty sections:** Skip the `createEl('h4', ...)` call entirely when the array is empty - satisfies the "hide empty sections" constraint automatically.

### Pattern 7: Ribbon Icon Registration

```typescript
// Source: obsidian.d.ts line 4575
// addRibbonIcon(icon: IconName, title: string, callback: (evt: MouseEvent) => any): HTMLElement

this.addRibbonIcon('brain-circuit', 'Open Active Recall Panel', () => {
    this.activateView();
});
```

**Icon Recommendation (Claude's Discretion):** Use `'brain-circuit'` - communicates AI + study/recall clearly and is available in Obsidian's bundled Lucide set. Alternative: `'book-open-check'` (study + completion). Both are valid `IconName` strings (typed as `string` in `obsidian.d.ts`).

### Anti-Patterns to Avoid

- **Using `containerEl.children[1]` for rendering:** Unstable - the element index can change across Obsidian versions. Always use `this.contentEl`.
- **Not detaching leaves in `onunload()`:** Causes duplicate sidebar panes when the plugin reloads during development or after update/disable/re-enable.
- **Calling `revealLeaf` without checking `getLeavesOfType` first:** Creates new leaf instead of focusing existing one.
- **Using `innerHTML` for panel content:** Bypasses Obsidian's security model and event management. Use `createEl`/`createDiv`.
- **Polling for sidebar refresh:** No polling. Refresh only when generation completes at a known call site.
- **Filtering the file-menu by exclusion list:** User decided against this. Register on all folders, no filtering logic.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Listing all vault folders | Recursive tree walk from vault root | `vault.getAllFolders(false)` | Built-in, handles all edge cases including symlinks and hidden folders |
| Reading YAML frontmatter | Manual string split on `---` delimiters | `metadataCache.getFileCache(file)?.frontmatter` | Synchronous, cached, handles all YAML edge cases |
| Preventing duplicate sidebar panes | "already open" flag in plugin class | `getLeavesOfType(VIEW_TYPE)` length check | Survives plugin reload; flag doesn't |
| Context menu registration and cleanup | Manual `addEventListener` on DOM | `this.registerEvent(workspace.on('file-menu', ...))` | `registerEvent` auto-removes listener on plugin unload |

**Key insight:** Obsidian's plugin API handles the lifecycle management that would otherwise require manual teardown. Use `registerView`, `registerEvent`, `addRibbonIcon`, and `addCommand` - all registered items are automatically cleaned up when the plugin unloads.

---

## Common Pitfalls

### Pitfall 1: Duplicate Sidebar Panes After Disable/Re-enable

**What goes wrong:** Users see two "Active Recall" panels in the sidebar after disabling and re-enabling the plugin.

**Why it happens:** `registerView` creates a new leaf without checking if one already exists. If `onunload()` does not call `detachLeavesOfType()`, orphaned leaves persist in the workspace.

**How to avoid:** Always call `this.app.workspace.detachLeavesOfType(VIEW_TYPE_ACTIVE_RECALL)` in `onunload()`. In `activateView()`, check `getLeavesOfType(VIEW_TYPE)` and focus the existing leaf rather than creating a new one.

**Warning signs:** Multiple tabs with the same panel name appear in the sidebar after plugin reload.

---

### Pitfall 2: `instanceof TFolder` Check Missing in file-menu Handler

**What goes wrong:** "Generate Self-Test" menu item appears when right-clicking files, not just folders.

**Why it happens:** The `file-menu` workspace event fires for both files and folders. The `file: TAbstractFile` parameter is either a `TFile` or a `TFolder`.

**How to avoid:** Guard with `if (!(file instanceof TFolder)) return;` as the first line of the handler. Import `TFolder` from `obsidian`.

**Warning signs:** Context menu item appears on `.md` files in the file explorer.

---

### Pitfall 3: Stale Sidebar State After Generation

**What goes wrong:** User generates from context menu or command palette; sidebar still shows the folder under "No self-test" until manual refresh.

**Why it happens:** `ItemView.onOpen()` renders once. No automatic re-render on vault changes.

**How to avoid:** Call `sidebarView.refresh()` at each generation call site after `await generationService.generate(folderPath)` resolves. Check `getLeavesOfType` first to avoid calling refresh when panel is not open.

**Warning signs:** Sidebar shows outdated data after generation completes (Notice fires but panel list is unchanged).

---

### Pitfall 4: Vault Root Folder Appearing in Sidebar

**What goes wrong:** Files at the vault root level create an entry for the root path `/` in the sidebar.

**Why it happens:** `vault.getAllFolders()` returns the root folder if `includeRoot` is true (default).

**How to avoid:** Call `vault.getAllFolders(false)` - the `false` argument excludes the vault root. Confirmed via `obsidian.d.ts`: `getAllFolders(includeRoot?: boolean): TFolder[]`.

---

### Pitfall 5: `_self-test.md` Itself Counted as an Eligible `.md` File

**What goes wrong:** A folder that only contains `_self-test.md` (no other notes) appears in "No self-test" or "Self-tests" sections even though it has no source notes.

**Why it happens:** The `.md` filter in `getEligibleFolders` doesn't exclude `_self-test.md`.

**How to avoid:** Filter out `_self-test.md` from the `.md` count check:
```typescript
folder.children.some(
    (child) => child instanceof TFile &&
               child.extension === 'md' &&
               child.basename !== '_self-test'
)
```
This matches the existing pattern in `collectNoteFiles` in `generation.ts`.

---

### Pitfall 6: Checking for `_self-test.md` by File Path String Construction

**What goes wrong:** Using string interpolation `${folder.path}/_self-test.md` and `getAbstractFileByPath()` works in most cases but breaks for vault root (path becomes `//_self-test.md`).

**Why it happens:** Vault root path is `/` in Obsidian's model. String concatenation produces double slash.

**How to avoid:** Since vault root is excluded (user constraint), this is mitigated. But as a best practice, check children directly:
```typescript
const selfTestFile = folder.children.find(
    (child): child is TFile =>
        child instanceof TFile && child.basename === '_self-test'
) ?? null;
```

---

## Code Examples

Verified patterns from official sources:

### Complete ItemView Skeleton

```typescript
// Source: marcusolsson.github.io/obsidian-plugin-docs/user-interface/views
// Signatures verified against installed obsidian.d.ts

import { ItemView, WorkspaceLeaf, App } from 'obsidian';

export const VIEW_TYPE_ACTIVE_RECALL = 'active-recall-panel';

export class ActiveRecallSidebarView extends ItemView {
    constructor(leaf: WorkspaceLeaf, private app: App, private generationService: GenerationService) {
        super(leaf);
    }

    getViewType(): string {
        return VIEW_TYPE_ACTIVE_RECALL;
    }

    getDisplayText(): string {
        return 'Active Recall';
    }

    getIcon(): string {
        return 'brain-circuit';
    }

    async onOpen(): Promise<void> {
        this.refresh();
    }

    async onClose(): Promise<void> {
        this.contentEl.empty();
    }

    refresh(): void {
        this.contentEl.empty();
        this.renderPanel();
    }

    private renderPanel(): void {
        // ... render logic here
    }
}
```

### Vault Folder Enumeration (with eligible filter)

```typescript
// Source: obsidian.d.ts line 6332 - vault.getAllFolders(includeRoot?: boolean): TFolder[]
// TFile.stat.mtime: confirmed in FileStats interface

import { App, TFolder, TFile } from 'obsidian';

interface FolderStatus {
    folder: TFolder;
    selfTestFile: TFile | null;
}

function getFolderStatuses(app: App): FolderStatus[] {
    return app.vault.getAllFolders(false)
        .filter((folder) =>
            folder.children.some(
                (child): child is TFile =>
                    child instanceof TFile &&
                    child.extension === 'md' &&
                    child.basename !== '_self-test'
            )
        )
        .map((folder) => ({
            folder,
            selfTestFile: (folder.children.find(
                (child): child is TFile =>
                    child instanceof TFile && child.basename === '_self-test'
            ) ?? null),
        }));
}
```

### CMD-02: Open Active Recall Panel Command

```typescript
// In main.ts onload(), after registerView:
this.addCommand({
    id: 'open-active-recall-panel',
    name: 'Open Active Recall Panel',
    callback: () => this.activateView(),
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `containerEl.children[1]` for ItemView content | `contentEl` property | Several Obsidian versions ago | `children[1]` breaks silently; `contentEl` is stable |
| Always `detachLeavesOfType` then re-open | `getLeavesOfType` check + `revealLeaf` | Documented since 0.9.7 but community discovered best practice ~2023 | Focus existing leaf rather than destroy+recreate |
| `workspace.getRightLeaf(false)` + `setViewState` | `workspace.ensureSideLeaf(type, side, opts)` | Since 1.7.2 | `ensureSideLeaf` is cleaner but requires 1.7.2+; plugin targets 0.15.0 so use older pattern |

**Deprecated/outdated:**
- `containerEl.children[1]`: Replaced by `contentEl`. Do not use.
- `ensureSideLeaf`: Not usable here due to `minAppVersion: 0.15.0` (requires 1.7.2).

---

## Open Questions

1. **Sidebar performance with large vaults**
   - What we know: `vault.getAllFolders()` + children scan is synchronous and in-memory; Obsidian keeps the file tree loaded.
   - What's unclear: Performance with vaults containing thousands of folders (unlikely edge case for a study tool).
   - Recommendation: Acceptable for v1. No lazy loading needed.

2. **Re-render frequency**
   - What we know: Refresh is triggered explicitly after `generate()` resolves.
   - What's unclear: Whether we also need to refresh on external file changes (e.g., user manually deletes `_self-test.md`).
   - Recommendation: Ignore for v1. Sidebar is a point-in-time view; a manual panel close+reopen refreshes it via `onOpen`. The user constraint says "after generation completes" - external edits not in scope.

3. **`revealLeaf` await behavior on Obsidian < 1.7.2**
   - What we know: `revealLeaf` is documented async since 1.7.2, but existed earlier as a sync method.
   - What's unclear: Whether awaiting a sync void function causes any issue.
   - Recommendation: `await undefined` is safe in JavaScript. No special handling needed.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest 30.2.0 with ts-jest |
| Config file | `jest.config.cjs` (project root) |
| Quick run command | `npx jest` |
| Full suite command | `npx jest` |

**Note:** No `test` script in `package.json`. Run via `npx jest` directly. Jest 30 uses `--testPathPatterns` (not `--testPathPattern`).

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CMD-02 | Command registered with correct id and name | unit | `npx jest --testPathPatterns sidebar` | - Wave 0 |
| CMD-03 | Context menu only fires for TFolder, not TFile | unit | `npx jest --testPathPatterns sidebar` | - Wave 0 |
| UI-01 | getFolderStatuses returns folders with selfTestFile non-null | unit | `npx jest --testPathPatterns sidebar` | - Wave 0 |
| UI-01 | Last-generated date derived from TFile.stat.mtime | unit | `npx jest --testPathPatterns sidebar` | - Wave 0 |
| UI-02 | getFolderStatuses returns folders with selfTestFile null | unit | `npx jest --testPathPatterns sidebar` | - Wave 0 |
| UI-01+02 | Vault root excluded; only folders with .md files (not _self-test) appear | unit | `npx jest --testPathPatterns sidebar` | - Wave 0 |
| UI-01+02 | No duplicate panes: activateView focuses existing leaf | unit | `npx jest --testPathPatterns sidebar` | - Wave 0 |

**Note:** `ItemView.onOpen` and DOM rendering cannot be tested without a full Obsidian runtime. Tests cover the pure logic functions (`getFolderStatuses`, eligibility filter, date derivation) and the `activateView` workspace interaction via mocks. DOM rendering is verified manually in Obsidian.

### Sampling Rate

- **Per task commit:** `npx jest`
- **Per wave merge:** `npx jest`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/__tests__/sidebar.test.ts` - covers CMD-02, CMD-03, UI-01, UI-02 logic functions
- [ ] Extend `src/__mocks__/obsidian.ts` to add `TFolder` children with `TFile` instances, `WorkspaceLeaf` mock, `Menu` mock with `addItem`, and `vault.getAllFolders` mock

*(No new framework needed - existing Jest + ts-jest infrastructure covers all phase requirements.)*

---

## Sources

### Primary (HIGH confidence)

- `node_modules/obsidian/obsidian.d.ts` (installed package) - all API signatures verified directly: `getAllFolders`, `file-menu` event, `getLeavesOfType`, `getRightLeaf`, `revealLeaf`, `detachLeavesOfType`, `addRibbonIcon`, `getFileCache`, `processFrontMatter`, `TFile.stat.mtime`, `FrontMatterCache`, `IconName`
- [marcusolsson.github.io/obsidian-plugin-docs/user-interface/views](https://marcusolsson.github.io/obsidian-plugin-docs/user-interface/views) - ItemView registration pattern, activateView with getLeavesOfType check

### Secondary (MEDIUM confidence)

- [upskil.dev/blog/obsidian_plugin_custom_view](https://upskil.dev/blog/obsidian_plugin_custom_view) - ItemView implementation with contentEl, onunload detach pattern - cross-verified against obsidian.d.ts
- [Obsidian Forum: How to correctly open an ItemView](https://forum.obsidian.md/t/how-to-correctly-open-an-itemview/60871) - getRightLeaf pattern, detachLeavesOfType in onunload

### Tertiary (LOW confidence)

- WebSearch results on `file-menu` event + TFolder pattern - confirmed consistent with obsidian.d.ts signature but no official docs page successfully fetched
- Icon name `'brain-circuit'` - available in Lucide, included in Obsidian's bundled icon set per community references; not validated against runtime `getIconIds()` output

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - all APIs verified directly in installed `obsidian.d.ts`
- Architecture: HIGH - patterns verified against official unofficial docs and cross-checked with API types
- Pitfalls: HIGH - pitfall 1 (duplicates) and 2 (TFolder check) are well-documented community knowledge; pitfalls 3-6 are derived directly from the API shape
- Icon name: LOW - `'brain-circuit'` is reasonable but not runtime-validated; any valid Lucide name works

**Research date:** 2026-03-11
**Valid until:** 2026-09-11 (stable Obsidian plugin API; 6-month estimate)

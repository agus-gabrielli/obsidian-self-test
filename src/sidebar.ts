import { ItemView, WorkspaceLeaf, App, TFile, TFolder, Menu, TAbstractFile } from 'obsidian';
import { GenerationService } from './generation';
import type ActiveRecallPlugin from './main';
import { TagPickerModal, LinkedNotesPickerModal, FolderPickerModal } from './modals';
import { isSelfTestFile } from './collectors';

export const VIEW_TYPE_ACTIVE_RECALL = 'active-recall-panel';

export type ActiveTab = 'folders' | 'tags' | 'links';

export interface FolderStatus {
  folder: TFolder;
  selfTestFile: TFile | null;
}

/**
 * Returns eligible folders (those with at least one non-_self-test .md file),
 * and whether each has a _self-test.md file.
 */
export function getFolderStatuses(app: App): FolderStatus[] {
  const folders = app.vault.getAllFolders(false);
  const result: FolderStatus[] = [];

  for (const folder of folders) {
    // Skip the _self-tests output directory and its subfolders
    if (folder.path === '_self-tests' || folder.path.startsWith('_self-tests/')) continue;

    const hasEligibleNote = folder.children.some(
      (child) =>
        child instanceof TFile &&
        child.extension === 'md' &&
        child.basename !== '_self-test'
    );

    if (!hasEligibleNote) continue;

    const selfTestFile =
      (folder.children.find(
        (child) =>
          child instanceof TFile && child.basename === '_self-test'
      ) as TFile) ?? null;

    result.push({ folder, selfTestFile });
  }

  return result;
}

/**
 * Returns the last generated date string derived from TFile.stat.mtime.
 */
export function getLastGeneratedDate(file: { stat: { mtime: number } }): string {
  return new Date(file.stat.mtime).toLocaleDateString();
}

/**
 * Returns an async function that activates (or reveals) the sidebar panel.
 * If the panel is already open, reveals the existing leaf.
 * Otherwise creates a new right leaf and sets the view state.
 */
export function buildActivateView(app: App): () => Promise<void> {
  return async () => {
    const existing = app.workspace.getLeavesOfType(VIEW_TYPE_ACTIVE_RECALL);
    if (existing.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      app.workspace.revealLeaf(existing[0]!);
      return;
    }
    const leaf = app.workspace.getRightLeaf(false);
    if (!leaf) return;
    await leaf.setViewState({ type: VIEW_TYPE_ACTIVE_RECALL, active: true });
    app.workspace.revealLeaf(leaf);
  };
}

/**
 * Returns a file-menu handler that adds a "Generate Self-Test" context menu item
 * when the target is a folder.
 *
 * Accepts a generate function so it can be tested without a full GenerationService instance.
 */
export function buildContextMenuHandler(
  generate: (folderPath: string) => Promise<void>,
  app?: App,
  viewType?: string
): (menu: Menu, file: TAbstractFile) => void {
  return (menu: Menu, file: TAbstractFile) => {
    if (!(file instanceof TFolder)) return;

    menu.addItem((item) =>
      item
        .setTitle('Generate Self-Test')
        .setIcon('brain-circuit')
        .onClick(async () => {
          await generate(file.path);
          if (app && viewType) {
            const leaves = app.workspace.getLeavesOfType(viewType);
            if (leaves.length > 0) {
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              const view = leaves[0]!.view as ActiveRecallSidebarView | null;
              if (view && typeof view.refresh === 'function') {
                view.refresh();
              }
            }
          }
        })
    );
  };
}

/**
 * The sidebar panel ItemView subclass.
 */
export class ActiveRecallSidebarView extends ItemView {
  private activeTab: ActiveTab;

  constructor(
    leaf: WorkspaceLeaf,
    private _app: App,
    private plugin: ActiveRecallPlugin,
    private generationService: GenerationService
  ) {
    super(leaf);
    this.activeTab = this.plugin.settings.activeTab ?? 'folders';
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

  public refresh(): void {
    this.contentEl.empty();
    this.renderPanel();
  }

  private async saveActiveTab(): Promise<void> {
    this.plugin.settings.activeTab = this.activeTab;
    await this.plugin.saveSettings();
  }

  private renderPanel(): void {
    const container = this.contentEl.createDiv({ cls: 'active-recall-panel' });

    // Fixed header
    const header = container.createDiv({ cls: 'active-recall-header' });
    header.createEl('h3', { text: 'Active Recall', cls: 'active-recall-title' });
    header.createEl('p', { text: 'Generate and review your self-tests.', cls: 'active-recall-description' });

    // Tab bar - three text tabs
    const tabBar = container.createDiv({ cls: 'active-recall-tab-bar' });
    for (const tab of ['folders', 'tags', 'links'] as const) {
      const label = tab.charAt(0).toUpperCase() + tab.slice(1);
      const btn = tabBar.createEl('button', {
        text: label,
        cls: tab === this.activeTab
          ? 'active-recall-tab active-recall-tab--active'
          : 'active-recall-tab',
      });
      btn.addEventListener('click', () => {
        this.activeTab = tab;
        this.saveActiveTab();
        this.refresh();
      });
    }

    // Generating banner - shown when any generation is in progress
    const anyGenerating =
      this.generationService.generatingFolders.size +
      this.generationService.generatingTags.size +
      this.generationService.generatingLinks.size > 0;
    if (anyGenerating) {
      const banner = container.createDiv({ cls: 'active-recall-generating-banner' });
      banner.createSpan({ cls: 'active-recall-spinner' });
      banner.createSpan({ text: 'Generating self-test...' });
    }

    // Panel content - separate DOM subtrees per mode
    const panel = container.createDiv({ cls: 'active-recall-panel-content' });
    if (this.activeTab === 'folders') this.renderFoldersPanel(panel);
    else if (this.activeTab === 'tags') this.renderTagsPanel(panel);
    else this.renderLinksPanel(panel);
  }

  private renderFoldersPanel(panel: HTMLElement): void {
    // "Generate for new folder" button at top
    const newBtn = panel.createEl('button', {
      text: 'Generate for new folder',
      cls: 'active-recall-btn active-recall-generate-new-btn',
    });
    newBtn.addEventListener('click', () => {
      new FolderPickerModal(this._app, (folderPath: string) => this.generateForFolder(folderPath)).open();
    });

    const statuses = getFolderStatuses(this._app);
    // Only show folders that have a _self-test.md (generated)
    const withSelfTest = statuses.filter((s) => s.selfTestFile !== null);

    // Collect folder paths already rendered (from withSelfTest) plus any in-progress
    const renderedFolderPaths = new Set<string>(withSelfTest.map((s) => s.folder.path));

    // Placeholder rows for folders currently generating that don't have a self-test yet
    const generatingAndNew = Array.from(this.generationService.generatingFolders).filter(
      (fp) => !renderedFolderPaths.has(fp)
    );

    if (withSelfTest.length === 0 && generatingAndNew.length === 0) {
      panel.createEl('p', {
        text: 'No self-tests generated yet. Use the button above to create one.',
        cls: 'active-recall-empty-state',
      });
      return;
    }

    const section = panel.createDiv({ cls: 'active-recall-section' });
    section.createEl('p', { text: 'Generated', cls: 'active-recall-section-label' });

    // Placeholder rows for folders being generated that have no self-test yet
    for (const folderPath of generatingAndNew) {
      this.renderSelfTestRow(section, folderPath, null, null, true, () => this.generateForFolder(folderPath));
    }

    for (const status of withSelfTest) {
      this.renderSelfTestRow(
        section,
        status.folder.path,
        status.selfTestFile ? getLastGeneratedDate(status.selfTestFile) : null,
        status.selfTestFile,
        this.generationService.generatingFolders.has(status.folder.path),
        () => this.generateForFolder(status.folder.path)
      );
    }
  }

  private renderTagsPanel(panel: HTMLElement): void {
    // "Generate for new tag" button
    const btn = panel.createEl('button', {
      text: 'Generate for new tag',
      cls: 'active-recall-btn active-recall-generate-new-btn',
    });
    btn.addEventListener('click', () => {
      new TagPickerModal(this._app, (tag: string) => this.generateForTag(tag)).open();
    });

    // Scan _self-tests/tags/ for existing tag self-tests
    const tagFiles = this._app.vault.getFiles().filter(
      (f: TFile) => f.extension === 'md' && f.path.startsWith('_self-tests/tags/')
    );

    // Derive tag names for existing files
    const existingTagNames = new Set<string>(
      tagFiles.map((f: TFile) => f.path.replace('_self-tests/tags/', '').replace(/\.md$/, ''))
    );

    // Placeholder entries for tags being generated that don't have a file yet
    const generatingAndNew = Array.from(this.generationService.generatingTags).filter(
      (tag) => !existingTagNames.has(tag)
    );

    if (tagFiles.length === 0 && generatingAndNew.length === 0) {
      panel.createEl('p', {
        text: 'No tag-based self-tests yet. Use the button above to create one.',
        cls: 'active-recall-empty-state',
      });
      return;
    }

    const section = panel.createDiv({ cls: 'active-recall-section' });
    section.createEl('p', { text: 'Generated', cls: 'active-recall-section-label' });

    // Placeholder rows for tags being generated with no file yet
    for (const tag of generatingAndNew) {
      this.renderSelfTestRow(section, tag, null, null, true, () => this.generateForTag(tag));
    }

    for (const file of tagFiles) {
      // Derive tag name: _self-tests/tags/lang/python.md -> lang/python
      const tagName = file.path.replace('_self-tests/tags/', '').replace(/\.md$/, '');
      this.renderSelfTestRow(
        section,
        tagName,
        getLastGeneratedDate(file),
        file,
        this.generationService.generatingTags.has(tagName),
        () => this.generateForTag(tagName)
      );
    }
  }

  private renderLinksPanel(panel: HTMLElement): void {
    // "Generate from linked notes" button
    const btn = panel.createEl('button', {
      text: 'Generate from linked notes',
      cls: 'active-recall-btn active-recall-generate-new-btn',
    });
    btn.addEventListener('click', () => {
      new LinkedNotesPickerModal(this._app, (file: TFile, depth: 1 | 2) =>
        this.generateForLinks(file, depth)
      ).open();
    });

    // Scan _self-tests/links/ for existing link self-tests
    const linkFiles = this._app.vault.getFiles().filter(
      (f: TFile) => f.extension === 'md' && f.path.startsWith('_self-tests/links/')
    );

    // Basenames for existing link files
    const existingBasenames = new Set<string>(linkFiles.map((f: TFile) => f.basename));

    // Placeholder entries for links being generated that don't have a file yet
    const generatingAndNew = Array.from(this.generationService.generatingLinks).filter(
      (basename) => !existingBasenames.has(basename)
    );

    if (linkFiles.length === 0 && generatingAndNew.length === 0) {
      panel.createEl('p', {
        text: 'No link-based self-tests yet. Use the button above to create one.',
        cls: 'active-recall-empty-state',
      });
      return;
    }

    const section = panel.createDiv({ cls: 'active-recall-section' });
    section.createEl('p', { text: 'Generated', cls: 'active-recall-section-label' });

    // Placeholder rows for links being generated with no file yet
    for (const basename of generatingAndNew) {
      this.renderSelfTestRow(section, basename, null, null, true, () => {});
    }

    for (const file of linkFiles) {
      this.renderSelfTestRow(
        section,
        file.basename,
        getLastGeneratedDate(file),
        file,
        this.generationService.generatingLinks.has(file.basename),
        () => this.regenerateForLinks(file)
      );
    }
  }

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

    // Clickable row - opens file in editor
    if (file) {
      row.addClass('active-recall-row--clickable');
      row.addEventListener('click', (evt: MouseEvent) => {
        if ((evt.target as HTMLElement).closest('button')) return;
        this._app.workspace.openLinkText(file.path, '', false);
      });
    }

    if (isGenerating) {
      const loading = row.createDiv({ cls: 'active-recall-loading' });
      loading.createSpan({ cls: 'active-recall-spinner' });
      loading.createSpan({ text: 'Generating...', cls: 'active-recall-loading-text' });
    } else {
      const btnText = file ? 'Regenerate' : 'Generate';
      const btn = row.createEl('button', { text: btnText, cls: 'active-recall-btn' });
      btn.addEventListener('click', onRegenerate);
    }
  }

  public async generateForFolder(folderPath: string): Promise<void> {
    this.generationService.generatingFolders.add(folderPath);
    this.refresh(); // show spinner / placeholder immediately
    try {
      await this.generationService.generate({ mode: 'folder', folderPath });
    } finally {
      this.generationService.generatingFolders.delete(folderPath);
      this.refresh(); // hide spinner
    }
  }

  public async generateForTag(tag: string): Promise<void> {
    const normalizedTag = tag.replace(/^#/, '');
    this.generationService.generatingTags.add(normalizedTag);
    this.refresh(); // show spinner / placeholder immediately
    try {
      await this.generationService.generate({ mode: 'tag', tag });
    } finally {
      this.generationService.generatingTags.delete(normalizedTag);
      this.refresh(); // hide spinner, update list
    }
  }

  public async generateForLinks(rootFile: TFile, depth: 1 | 2): Promise<void> {
    this.generationService.generatingLinks.add(rootFile.basename);
    this.refresh(); // show spinner / placeholder immediately
    try {
      await this.generationService.generate({ mode: 'links', rootFile, depth });
    } finally {
      this.generationService.generatingLinks.delete(rootFile.basename);
      this.refresh();
    }
  }

  private async regenerateForLinks(outputFile: TFile): Promise<void> {
    // Look up the original root note by matching basename
    const rootFile = this._app.vault.getFiles().find(
      (f: TFile) => f.basename === outputFile.basename && !isSelfTestFile(f)
    );
    if (!rootFile) {
      // Cannot find root note - open picker as fallback
      new LinkedNotesPickerModal(this._app, (file: TFile, depth: 1 | 2) =>
        this.generateForLinks(file, depth)
      ).open();
      return;
    }
    await this.generateForLinks(rootFile, 1);
  }
}

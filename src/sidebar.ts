import { ItemView, WorkspaceLeaf, App, TFile, TFolder, Menu, TAbstractFile, setIcon } from 'obsidian';
import { GenerationService } from './generation';
import type SelfTestPlugin from './main';
import { TagPickerModal, FolderPickerModal, DeleteConfirmModal, openLinkedNotesPicker } from './modals';
import { isSelfTestFile } from './collectors';

export const VIEW_TYPE_SELF_TEST = 'self-test-panel';

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

    const found = folder.children.find(
      (child) =>
        child instanceof TFile && child.basename === '_self-test'
    );
    const selfTestFile = found instanceof TFile ? found : null;

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
    const existing = app.workspace.getLeavesOfType(VIEW_TYPE_SELF_TEST);
    const first = existing[0];
    if (first) {
      void app.workspace.revealLeaf(first);
      return;
    }
    const leaf = app.workspace.getRightLeaf(false);
    if (!leaf) return;
    await leaf.setViewState({ type: VIEW_TYPE_SELF_TEST, active: true });
    void app.workspace.revealLeaf(leaf);
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
        .setTitle('Generate self-test')
        .setIcon('brain-circuit')
        .onClick(() => {
          void (async () => {
            await generate(file.path);
            if (app && viewType) {
              const leaves = app.workspace.getLeavesOfType(viewType);
              const leaf = leaves[0];
              if (leaf && leaf.view instanceof SelfTestSidebarView) {
                leaf.view.refresh();
              }
            }
          })();
        })
    );
  };
}

/**
 * The sidebar panel ItemView subclass.
 */
export class SelfTestSidebarView extends ItemView {
  private activeTab: ActiveTab;

  constructor(
    leaf: WorkspaceLeaf,
    private _app: App,
    private plugin: SelfTestPlugin,
    private generationService: GenerationService
  ) {
    super(leaf);
    this.activeTab = this.plugin.settings.activeTab ?? 'folders';
  }

  getViewType(): string {
    return VIEW_TYPE_SELF_TEST;
  }

  getDisplayText(): string {
    return 'Self test';
  }

  getIcon(): string {
    return 'brain-circuit';
  }

  onOpen(): Promise<void> {
    this.refresh();
    return Promise.resolve();
  }

  onClose(): Promise<void> {
    this.contentEl.empty();
    return Promise.resolve();
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
    const container = this.contentEl.createDiv({ cls: 'self-test-panel' });

    // Fixed header
    const header = container.createDiv({ cls: 'self-test-header' });
    header.createEl('h3', { text: 'Self test', cls: 'self-test-title' });
    header.createEl('p', { text: 'Generate and review your self-tests.', cls: 'self-test-description' });

    // Tab bar - three text tabs
    const tabBar = container.createDiv({ cls: 'self-test-tab-bar' });
    for (const tab of ['folders', 'tags', 'links'] as const) {
      const label = tab.charAt(0).toUpperCase() + tab.slice(1);
      const btn = tabBar.createEl('button', {
        text: label,
        cls: tab === this.activeTab
          ? 'self-test-tab self-test-tab--active'
          : 'self-test-tab',
      });
      btn.addEventListener('click', () => {
        this.activeTab = tab;
        void this.saveActiveTab();
        this.refresh();
      });
    }

    // Panel content - separate DOM subtrees per mode
    const panel = container.createDiv({ cls: 'self-test-panel-content' });
    if (this.activeTab === 'folders') this.renderFoldersPanel(panel);
    else if (this.activeTab === 'tags') this.renderTagsPanel(panel);
    else this.renderLinksPanel(panel);
  }

  private renderFoldersPanel(panel: HTMLElement): void {
    // "Generate for new folder" button at top
    const newBtn = panel.createEl('button', {
      text: 'Generate for new folder',
      cls: 'self-test-btn self-test-generate-new-btn',
    });
    newBtn.addEventListener('click', () => {
      new FolderPickerModal(this._app, (folderPath: string) => { void this.generateForFolder(folderPath); }).open();
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
        cls: 'self-test-empty-state',
      });
      return;
    }

    const section = panel.createDiv({ cls: 'self-test-section' });
    section.createEl('p', { text: 'Generated', cls: 'self-test-section-label' });

    // Placeholder rows for folders being generated that have no self-test yet
    for (const folderPath of generatingAndNew) {
      this.renderSelfTestRow(section, folderPath, null, null, true, () => { void this.generateForFolder(folderPath); }, null);
    }

    for (const status of withSelfTest) {
      const stFile = status.selfTestFile;
      this.renderSelfTestRow(
        section,
        status.folder.path,
        stFile ? getLastGeneratedDate(stFile) : null,
        stFile,
        this.generationService.generatingFolders.has(status.folder.path),
        () => { void this.generateForFolder(status.folder.path); },
        stFile ? () => this.deleteSelfTest(stFile) : null
      );
    }
  }

  private renderTagsPanel(panel: HTMLElement): void {
    // "Generate for new tag" button
    const btn = panel.createEl('button', {
      text: 'Generate for new tag',
      cls: 'self-test-btn self-test-generate-new-btn',
    });
    btn.addEventListener('click', () => {
      new TagPickerModal(this._app, (tag: string) => { void this.generateForTag(tag); }).open();
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
        cls: 'self-test-empty-state',
      });
      return;
    }

    const section = panel.createDiv({ cls: 'self-test-section' });
    section.createEl('p', { text: 'Generated', cls: 'self-test-section-label' });

    // Placeholder rows for tags being generated with no file yet
    for (const tag of generatingAndNew) {
      this.renderSelfTestRow(section, tag, null, null, true, () => { void this.generateForTag(tag); }, null);
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
        () => { void this.generateForTag(tagName); },
        () => this.deleteSelfTest(file)
      );
    }
  }

  private renderLinksPanel(panel: HTMLElement): void {
    // "Generate from linked notes" button
    const btn = panel.createEl('button', {
      text: 'Generate from linked notes',
      cls: 'self-test-btn self-test-generate-new-btn',
    });
    btn.addEventListener('click', () => {
      openLinkedNotesPicker(this._app, (file: TFile, depth: 1 | 2) => {
        void this.generateForLinks(file, depth);
      });
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
        cls: 'self-test-empty-state',
      });
      return;
    }

    const section = panel.createDiv({ cls: 'self-test-section' });
    section.createEl('p', { text: 'Generated', cls: 'self-test-section-label' });

    // Placeholder rows for links being generated with no file yet
    for (const basename of generatingAndNew) {
      this.renderSelfTestRow(section, basename, null, null, true, () => {}, null);
    }

    for (const file of linkFiles) {
      this.renderSelfTestRow(
        section,
        file.basename,
        getLastGeneratedDate(file),
        file,
        this.generationService.generatingLinks.has(file.basename),
        () => { void this.regenerateForLinks(file); },
        () => this.deleteSelfTest(file)
      );
    }
  }

  private renderSelfTestRow(
    container: HTMLElement,
    name: string,
    date: string | null,
    file: TFile | null,
    isGenerating: boolean,
    onRegenerate: () => void,
    onDelete: (() => void) | null
  ): void {
    const row = container.createDiv({ cls: 'self-test-folder-row' });
    const info = row.createDiv({ cls: 'self-test-folder-info' });
    info.createSpan({ text: name, cls: 'self-test-folder-name' });
    if (date) {
      info.createSpan({ text: date, cls: 'self-test-date' });
    }

    // Clickable row - opens file in editor
    if (file) {
      row.addClass('self-test-row--clickable');
      row.addEventListener('click', (evt: MouseEvent) => {
        if ((evt.target as HTMLElement).closest('button')) return;
        void this._app.workspace.openLinkText(file.path, '', false);
      });
    }

    if (isGenerating) {
      const loading = row.createDiv({ cls: 'self-test-loading' });
      loading.createSpan({ cls: 'self-test-spinner' });
      loading.createSpan({ text: 'Generating...', cls: 'self-test-loading-text' });
    } else {
      const btnText = file ? 'Regenerate' : 'Generate';
      const btn = row.createEl('button', { text: btnText, cls: 'self-test-btn' });
      btn.addEventListener('click', onRegenerate);
    }

    if (!isGenerating && file) {
      const trashBtn = row.createEl('button', {
        cls: 'self-test-trash-btn clickable-icon',
        attr: { 'aria-label': 'Delete self-test' },
      });
      setIcon(trashBtn, 'trash-2');
      trashBtn.addEventListener('click', (evt: MouseEvent) => {
        evt.stopPropagation();
        if (onDelete) onDelete();
      });
    }
  }

  private deleteSelfTest(file: TFile): void {
    new DeleteConfirmModal(this._app, file.path, () => {
      void (async () => {
        await this._app.fileManager.trashFile(file);
        this.refresh();
      })();
    }).open();
  }

  private showGeneratingToast(): void {
    // Remove any existing toast
    document.querySelector('.self-test-toast')?.remove();

    const toast = document.createElement('div');
    toast.className = 'self-test-toast';
    const spinner = document.createElement('span');
    spinner.className = 'self-test-spinner';
    toast.appendChild(spinner);
    const text = document.createElement('span');
    text.textContent = 'Generating self-test...';
    toast.appendChild(text);
    document.body.appendChild(toast);

    // Trigger entrance animation
    requestAnimationFrame(() => toast.classList.add('self-test-toast--visible'));
  }

  private hideGeneratingToast(): void {
    const toast = document.querySelector('.self-test-toast');
    if (!toast) return;
    toast.classList.remove('self-test-toast--visible');
    toast.classList.add('self-test-toast--hiding');
    setTimeout(() => toast.remove(), 400);
  }

  public async generateForFolder(folderPath: string): Promise<void> {
    this.generationService.generatingFolders.add(folderPath);
    this.refresh();
    this.showGeneratingToast();
    try {
      await this.generationService.generate({ mode: 'folder', folderPath });
    } finally {
      this.generationService.generatingFolders.delete(folderPath);
      this.hideGeneratingToast();
      this.refresh();
    }
  }

  public async generateForTag(tag: string): Promise<void> {
    const normalizedTag = tag.replace(/^#/, '');
    this.generationService.generatingTags.add(normalizedTag);
    this.refresh();
    this.showGeneratingToast();
    try {
      await this.generationService.generate({ mode: 'tag', tag });
    } finally {
      this.generationService.generatingTags.delete(normalizedTag);
      this.hideGeneratingToast();
      this.refresh();
    }
  }

  public async generateForLinks(rootFile: TFile, depth: 1 | 2): Promise<void> {
    this.generationService.generatingLinks.add(rootFile.basename);
    this.refresh();
    this.showGeneratingToast();
    try {
      await this.generationService.generate({ mode: 'links', rootFile, depth });
    } finally {
      this.generationService.generatingLinks.delete(rootFile.basename);
      this.hideGeneratingToast();
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
      openLinkedNotesPicker(this._app, (file: TFile, depth: 1 | 2) => {
        void this.generateForLinks(file, depth);
      });
      return;
    }
    await this.generateForLinks(rootFile, 1);
  }
}

import { ItemView, WorkspaceLeaf, App, TFile, TFolder, Menu, TAbstractFile } from 'obsidian';
import { GenerationService } from './generation';

export const VIEW_TYPE_ACTIVE_RECALL = 'active-recall-panel';

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
  constructor(
    leaf: WorkspaceLeaf,
    private _app: App,
    private generationService: GenerationService
  ) {
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

  public refresh(): void {
    this.contentEl.empty();
    this.renderPanel();
  }

  private renderPanel(): void {
    const statuses = getFolderStatuses(this._app);
    const withSelfTest = statuses.filter((s) => s.selfTestFile !== null);
    const withoutSelfTest = statuses.filter((s) => s.selfTestFile === null);

    const container = this.contentEl.createDiv({ cls: 'active-recall-panel' });

    if (withSelfTest.length > 0) {
      const section = container.createDiv({ cls: 'active-recall-section' });
      section.createEl('h4', { text: 'Generated' });
      for (const status of withSelfTest) {
        const row = section.createDiv({ cls: 'active-recall-folder-row' });
        row.createSpan({ text: status.folder.path });
        if (status.selfTestFile) {
          row.createSpan({
            text: getLastGeneratedDate(status.selfTestFile),
            cls: 'active-recall-date',
          });
        }
        const btn = row.createEl('button', { text: 'Regenerate' });
        btn.addEventListener('click', () => this.onGenerate(status.folder.path));
      }
    }

    if (withoutSelfTest.length > 0) {
      const section = container.createDiv({ cls: 'active-recall-section' });
      section.createEl('h4', { text: 'Not generated' });
      for (const status of withoutSelfTest) {
        const row = section.createDiv({ cls: 'active-recall-folder-row' });
        row.createSpan({ text: status.folder.path });
        const btn = row.createEl('button', { text: 'Generate' });
        btn.addEventListener('click', () => this.onGenerate(status.folder.path));
      }
    }
  }

  private async onGenerate(folderPath: string): Promise<void> {
    await this.generationService.generate(folderPath);
    this.refresh();
  }
}

/**
 * Mock implementations of Obsidian classes needed by generation.ts and sidebar.ts
 * Used by Jest via moduleNameMapper: { '^obsidian$': '<rootDir>/src/__mocks__/obsidian.ts' }
 */

export class TFile {
  basename: string;
  extension: string;
  path: string;
  stat = { mtime: Date.now() };
  parent: { path: string } | null;

  constructor(path: string, extension = 'md') {
    this.path = path;
    this.extension = extension;
    const parts = path.split('/');
    const filename = parts[parts.length - 1] ?? '';
    this.basename = filename.endsWith(`.${extension}`)
      ? filename.slice(0, -(extension.length + 1))
      : filename;
    const dirParts = parts.slice(0, -1);
    this.parent = dirParts.length > 0 ? { path: dirParts.join('/') } : null;
  }
}

export class TFolder {
  children: (TFile | TFolder)[];
  path: string;

  constructor(path: string, children: (TFile | TFolder)[] = []) {
    this.path = path;
    this.children = children;
  }
}

// Type alias for abstract file union - used by context menu handlers
export type TAbstractFile = TFile | TFolder;

export const Notice = jest.fn().mockImplementation(function (this: { message: string }, message: string) {
  this.message = message;
});

export const requestUrl = jest.fn().mockResolvedValue({
  status: 200,
  json: {
    choices: [
      {
        message: { content: '' },
        finish_reason: 'stop',
      },
    ],
  },
});

export const getAllTags = jest.fn().mockReturnValue([]);

export interface CachedMetadata {
  tags?: Array<{ tag: string }>;
  frontmatter?: Record<string, unknown>;
}

export class WorkspaceLeaf {
  view: unknown = null;
  async setViewState(_state: { type: string; active: boolean }): Promise<void> {}
}

export class MenuItem {
  _title = '';
  _icon = '';
  _callback: () => void = () => {};
  setTitle(title: string): this { this._title = title; return this; }
  setIcon(icon: string): this { this._icon = icon; return this; }
  onClick(cb: () => void): this { this._callback = cb; return this; }
}

export class Menu {
  private items: Array<{ title: string; icon: string; callback: () => void }> = [];
  addItem(cb: (item: MenuItem) => void): this {
    const item = new MenuItem();
    cb(item);
    this.items.push({ title: item._title, icon: item._icon, callback: item._callback });
    return this;
  }
  getItems() { return this.items; }
}

// Minimal App interface - production type from Obsidian
export interface App {
  vault: {
    getAbstractFileByPath(path: string): TFile | TFolder | null;
    read(file: TFile): Promise<string>;
    create(path: string, content: string): Promise<TFile>;
    modify(file: TFile, content: string): Promise<void>;
    getAllFolders(includeRoot?: boolean): TFolder[];
    getFiles(): TFile[];
    getFileByPath(path: string): TFile | null;
    createFolder(path: string): Promise<void>;
    trash(file: TFile | TFolder, system: boolean): Promise<void>;
  };
  workspace: {
    getLeavesOfType(type: string): WorkspaceLeaf[];
    getRightLeaf(split: boolean): WorkspaceLeaf;
    revealLeaf(leaf: WorkspaceLeaf): void;
    openLinkText(linktext: string, sourcePath: string, newLeaf: boolean): Promise<void>;
  };
  metadataCache: {
    getFileCache(file: TFile): CachedMetadata | null;
    resolvedLinks: Record<string, Record<string, number>>;
  };
}

/**
 * Factory function for creating a mock Obsidian App.
 * Not an Obsidian export - internal test helper.
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function createMockApp() {
  return {
    vault: {
      getAbstractFileByPath: jest.fn().mockReturnValue(null),
      read: jest.fn().mockResolvedValue(''),
      create: jest.fn().mockImplementation((path: string, _content: string) => {
        return Promise.resolve(new TFile(path));
      }),
      modify: jest.fn().mockResolvedValue(undefined),
      getAllFolders: jest.fn().mockReturnValue([]),
      getFiles: jest.fn().mockReturnValue([]),
      getFileByPath: jest.fn().mockReturnValue(null),
      createFolder: jest.fn().mockResolvedValue(undefined),
      trash: jest.fn().mockResolvedValue(undefined),
    },
    workspace: {
      getLeavesOfType: jest.fn().mockReturnValue([]),
      getRightLeaf: jest.fn(),
      revealLeaf: jest.fn().mockResolvedValue(undefined),
      openLinkText: jest.fn().mockResolvedValue(undefined),
    },
    metadataCache: {
      getFileCache: jest.fn().mockReturnValue(null),
      resolvedLinks: {} as Record<string, Record<string, number>>,
    },
  };
}

// Helper: make a mock DOM-like element that sidebar.ts can call createEl/createDiv/createSpan on
export function makeMockEl(): {
  empty: jest.Mock;
  createDiv: jest.Mock;
  createEl: jest.Mock;
  createSpan: jest.Mock;
  addEventListener: jest.Mock;
  addClass: jest.Mock;
  querySelectorAll: jest.Mock;
  setText: jest.Mock;
} {
  return {
    empty: jest.fn(),
    createDiv: jest.fn().mockImplementation(() => makeMockEl()),
    createEl: jest.fn().mockImplementation((_tag: string, _opts?: unknown) => makeMockEl()),
    createSpan: jest.fn().mockImplementation(() => makeMockEl()),
    addEventListener: jest.fn(),
    addClass: jest.fn(),
    querySelectorAll: jest.fn().mockReturnValue([]),
    setText: jest.fn(),
  };
}

// Minimal PluginSettingTab base class - allows ActiveRecallSettingTab to extend it in tests
export class PluginSettingTab {
  app: unknown;
  containerEl: {
    empty: () => void;
  };

  constructor(_app: unknown, _plugin: unknown) {
    this.app = _app;
    this.containerEl = { empty: () => {} };
  }
}

// Minimal Setting class - allows settings UI to be instantiated in tests
export class Setting {
  constructor(_containerEl: unknown) {}
  setName(_name: string): this { return this; }
  setDesc(_desc: string): this { return this; }
  setHeading(): this { return this; }
  setDisabled(_disabled: boolean): this { return this; }
  addDropdown(_cb: (drop: { addOption: () => unknown; setValue: () => unknown; onChange: () => unknown }) => void): this { return this; }
  addText(_cb: (text: { inputEl: { type: string }; setPlaceholder: () => unknown; setValue: () => unknown; onChange: () => unknown }) => void): this { return this; }
  addToggle(_cb: (toggle: { setValue: () => unknown; onChange: () => unknown }) => void): this { return this; }
  addTextArea(_cb: (text: { setPlaceholder: () => unknown; setValue: () => unknown; inputEl: { addEventListener: () => unknown } }) => void): this { return this; }
}

// Minimal ItemView base class - allows ActiveRecallSidebarView to extend it in tests
export class ItemView {
  contentEl: ReturnType<typeof makeMockEl>;
  leaf: WorkspaceLeaf;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app: any;

  constructor(leaf: WorkspaceLeaf) {
    this.leaf = leaf;
    this.contentEl = makeMockEl();
    this.app = createMockApp();
  }
}

export class SuggestModal<T> {
  app: unknown;
  constructor(app: unknown) { this.app = app; }
  setPlaceholder(_text: string): void {}
  close(): void {}
  getSuggestions(_query: string): T[] { return []; }
  renderSuggestion(_item: T, _el: HTMLElement): void {}
  onChooseSuggestion(_item: T, _evt: MouseEvent | KeyboardEvent): void {}
  open(): void {}
}

export class FuzzySuggestModal<T> extends SuggestModal<{ item: T }> {
  constructor(app: unknown) { super(app); }
  getItems(): T[] { return []; }
  getItemText(_item: T): string { return ''; }
  onChooseItem(_item: T, _evt: MouseEvent | KeyboardEvent): void {}
  getSuggestions(_query: string): { item: T }[] { return []; }
  renderSuggestion(_item: { item: T }, _el: HTMLElement): void {}
  onChooseSuggestion(_item: { item: T }, _evt: MouseEvent | KeyboardEvent): void {}
}

export class Modal {
  app: unknown;
  contentEl: ReturnType<typeof makeMockEl>;
  constructor(app: unknown) {
    this.app = app;
    this.contentEl = makeMockEl();
  }
  open(): void {}
  close(): void {}
}

/**
 * Factory function for creating a mock status bar item.
 * Not an Obsidian export - internal test helper.
 */
export function createMockStatusBarItem() {
  return {
    setText: jest.fn(),
  };
}

/**
 * Factory function for creating a mock WorkspaceLeaf.
 * Not an Obsidian export - internal test helper.
 */
export function createMockWorkspaceLeaf() {
  const leaf = new WorkspaceLeaf();
  return leaf;
}

export function setIcon(_el: HTMLElement, _iconId: string): void {}

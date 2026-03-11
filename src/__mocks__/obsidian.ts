/**
 * Mock implementations of Obsidian classes needed by generation.ts and sidebar.ts
 * Used by Jest via moduleNameMapper: { '^obsidian$': '<rootDir>/src/__mocks__/obsidian.ts' }
 */

export class TFile {
  basename: string;
  extension: string;
  path: string;
  stat = { mtime: Date.now() };

  constructor(path: string, extension = 'md') {
    this.path = path;
    this.extension = extension;
    const parts = path.split('/');
    const filename = parts[parts.length - 1] ?? '';
    this.basename = filename.endsWith(`.${extension}`)
      ? filename.slice(0, -(extension.length + 1))
      : filename;
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

export class Notice {
  message: string;

  constructor(message: string) {
    this.message = message;
  }
}

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
  };
  workspace: {
    getLeavesOfType(type: string): WorkspaceLeaf[];
    getRightLeaf(split: boolean): WorkspaceLeaf;
    revealLeaf(leaf: WorkspaceLeaf): void;
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
    },
    workspace: {
      getLeavesOfType: jest.fn().mockReturnValue([]),
      getRightLeaf: jest.fn(),
      revealLeaf: jest.fn().mockResolvedValue(undefined),
    },
  };
}

// Helper: make a mock DOM-like element that sidebar.ts can call createEl/createDiv/createSpan on
function makeMockEl(): {
  empty: jest.Mock;
  createDiv: jest.Mock;
  createEl: jest.Mock;
  createSpan: jest.Mock;
  addEventListener: jest.Mock;
} {
  return {
    empty: jest.fn(),
    createDiv: jest.fn().mockImplementation(() => makeMockEl()),
    createEl: jest.fn().mockImplementation(() => makeMockEl()),
    createSpan: jest.fn().mockImplementation(() => makeMockEl()),
    addEventListener: jest.fn(),
  };
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

import { TFile, TFolder, Menu, createMockApp, createMockWorkspaceLeaf } from '../__mocks__/obsidian';
import {
  getFolderStatuses,
  getLastGeneratedDate,
  buildContextMenuHandler,
  buildActivateView,
  ActiveRecallSidebarView,
} from '../sidebar';
import { DEFAULT_SETTINGS } from '../settings';

// Helper to create a testable sidebar instance
function createTestSidebar(opts: {
  activeTab?: 'folders' | 'tags' | 'links';
  vaultFiles?: TFile[];
  generatingTags?: string[];
  generatingLinks?: string[];
  generatingFolders?: string[];
} = {}) {
  const app = createMockApp();
  if (opts.vaultFiles) {
    app.vault.getFiles.mockReturnValue(opts.vaultFiles);
  }
  const mockPlugin = {
    settings: { ...DEFAULT_SETTINGS, activeTab: opts.activeTab ?? 'folders' },
    saveSettings: jest.fn().mockResolvedValue(undefined),
  };
  const genService = {
    generatingFolders: new Set<string>(opts.generatingFolders ?? []),
    generatingTags: new Set<string>(opts.generatingTags ?? []),
    generatingLinks: new Set<string>(opts.generatingLinks ?? []),
    generate: jest.fn().mockResolvedValue(undefined),
  };
  const leaf = createMockWorkspaceLeaf();
  const view = new ActiveRecallSidebarView(
    leaf as never,
    app as never,
    mockPlugin as never,
    genService as never
  );
  return { view, app, mockPlugin, genService };
}

describe('getFolderStatuses', () => {
  it('returns only folders with at least one non-_self-test .md file', () => {
    const noteFile = new TFile('Notes/note1.md');
    const folder = new TFolder('Notes', [noteFile]);
    const app = createMockApp();
    app.vault.getAllFolders.mockReturnValue([folder]);

    const statuses = getFolderStatuses(app as never);

    expect(statuses).toHaveLength(1);
    expect(statuses[0]!.folder).toBe(folder);
  });

  it('folder with _self-test.md child has selfTestFile non-null', () => {
    const noteFile = new TFile('Notes/note1.md');
    const selfTestFile = new TFile('Notes/_self-test.md');
    const folder = new TFolder('Notes', [noteFile, selfTestFile]);
    const app = createMockApp();
    app.vault.getAllFolders.mockReturnValue([folder]);

    const statuses = getFolderStatuses(app as never);

    expect(statuses).toHaveLength(1);
    expect(statuses[0]!.selfTestFile).toBe(selfTestFile);
  });

  it('folder without _self-test.md child has selfTestFile null', () => {
    const noteFile = new TFile('Notes/note1.md');
    const folder = new TFolder('Notes', [noteFile]);
    const app = createMockApp();
    app.vault.getAllFolders.mockReturnValue([folder]);

    const statuses = getFolderStatuses(app as never);

    expect(statuses).toHaveLength(1);
    expect(statuses[0]!.selfTestFile).toBeNull();
  });

  it('folder whose only .md file is _self-test.md is excluded (not eligible)', () => {
    const selfTestFile = new TFile('Notes/_self-test.md');
    const folder = new TFolder('Notes', [selfTestFile]);
    const app = createMockApp();
    app.vault.getAllFolders.mockReturnValue([folder]);

    const statuses = getFolderStatuses(app as never);

    expect(statuses).toHaveLength(0);
  });

  it('folder with no .md files at all is excluded', () => {
    const imgFile = new TFile('Notes/image.png', 'png');
    const folder = new TFolder('Notes', [imgFile]);
    const app = createMockApp();
    app.vault.getAllFolders.mockReturnValue([folder]);

    const statuses = getFolderStatuses(app as never);

    expect(statuses).toHaveLength(0);
  });

  it('excludes _self-tests directory and its subfolders', () => {
    const noteFile = new TFile('Notes/note1.md');
    const notesFolder = new TFolder('Notes', [noteFile]);
    const tagFile = new TFile('_self-tests/tags/python.md');
    const selfTestsFolder = new TFolder('_self-tests', [tagFile]);
    const tagsFolder = new TFolder('_self-tests/tags', [tagFile]);
    const app = createMockApp();
    app.vault.getAllFolders.mockReturnValue([notesFolder, selfTestsFolder, tagsFolder]);

    const statuses = getFolderStatuses(app as never);

    expect(statuses).toHaveLength(1);
    expect(statuses[0]!.folder).toBe(notesFolder);
  });
});

describe('getLastGeneratedDate', () => {
  it('returns toLocaleDateString() string derived from TFile.stat.mtime', () => {
    const selfTestFile = new TFile('Notes/_self-test.md');
    const fixedTime = new Date('2025-06-15').getTime();
    selfTestFile.stat = { mtime: fixedTime };

    const result = getLastGeneratedDate(selfTestFile);

    expect(result).toBe(new Date(fixedTime).toLocaleDateString());
  });
});

describe('activateView', () => {
  it('when getLeavesOfType returns a leaf, calls revealLeaf on it and does NOT call getRightLeaf', async () => {
    const app = createMockApp();
    const mockLeaf = { setViewState: jest.fn().mockResolvedValue(undefined) };
    app.workspace.getLeavesOfType.mockReturnValue([mockLeaf]);

    const activateView = buildActivateView(app as never);
    await activateView();

    expect(app.workspace.revealLeaf).toHaveBeenCalledWith(mockLeaf);
    expect(app.workspace.getRightLeaf).not.toHaveBeenCalled();
  });

  it('when getLeavesOfType returns [], calls getRightLeaf then setViewState then revealLeaf', async () => {
    const app = createMockApp();
    app.workspace.getLeavesOfType.mockReturnValue([]);
    const newLeaf = { setViewState: jest.fn().mockResolvedValue(undefined) };
    app.workspace.getRightLeaf.mockReturnValue(newLeaf);

    const activateView = buildActivateView(app as never);
    await activateView();

    expect(app.workspace.getRightLeaf).toHaveBeenCalled();
    expect(newLeaf.setViewState).toHaveBeenCalled();
    expect(app.workspace.revealLeaf).toHaveBeenCalledWith(newLeaf);
  });
});

describe('file-menu context menu handler', () => {
  it('when file is TFolder instance, adds "Generate Self-Test" item to menu', () => {
    const folder = new TFolder('Notes', []);
    const menu = new Menu();
    const handler = buildContextMenuHandler(jest.fn());

    handler(menu as never, folder as never);

    const items = menu.getItems();
    expect(items).toHaveLength(1);
    expect(items[0]!.title).toBe('Generate Self-Test');
  });

  it('when file is TFile instance, does NOT add any item to menu', () => {
    const file = new TFile('Notes/note.md');
    const menu = new Menu();
    const handler = buildContextMenuHandler(jest.fn());

    handler(menu as never, file as never);

    const items = menu.getItems();
    expect(items).toHaveLength(0);
  });
});

describe('tabbed sidebar', () => {
  it('renderPanel creates a tab bar with three tabs: Folders, Tags, Links', () => {
    const { view } = createTestSidebar({ activeTab: 'folders' });
    view.refresh();

    // contentEl.createDiv is called first to create the panel container
    expect(view.contentEl.createDiv).toHaveBeenCalledWith({ cls: 'active-recall-panel' });

    // The panel container (first createDiv call result) creates the tab bar div
    const panelContainer = (view.contentEl.createDiv as jest.Mock).mock.results[0]!.value;
    expect(panelContainer.createDiv).toHaveBeenCalledWith({ cls: 'active-recall-tab-bar' });

    // The tab bar div creates buttons for each tab
    const tabBarEl = panelContainer.createDiv.mock.results.find(
      (r: { value: { createEl: jest.Mock } }) => {
        const calls = r.value.createEl?.mock?.calls ?? [];
        return calls.some((c: unknown[]) => c[0] === 'button');
      }
    );
    // The tab bar is the second createDiv call on panelContainer (after header)
    // Check that buttons for Folders, Tags, Links were created
    const allCreateElCalls: unknown[][] = [];
    for (const result of panelContainer.createDiv.mock.results) {
      const el = result.value as { createEl: jest.Mock };
      if (el.createEl?.mock?.calls) {
        allCreateElCalls.push(...el.createEl.mock.calls);
      }
    }
    const buttonTexts = allCreateElCalls
      .filter((c) => c[0] === 'button')
      .map((c) => (c[1] as { text: string }).text);

    expect(buttonTexts).toContain('Folders');
    expect(buttonTexts).toContain('Tags');
    expect(buttonTexts).toContain('Links');
    expect(tabBarEl).toBeDefined();
  });

  it('clicking Tags tab sets activeTab to tags and re-renders', () => {
    const { view } = createTestSidebar({ activeTab: 'folders' });
    view.refresh();

    const panelContainer = (view.contentEl.createDiv as jest.Mock).mock.results[0]!.value;
    // Find the tab bar createDiv result
    const tabBarResult = panelContainer.createDiv.mock.results.find(
      (r: { value: { createEl: jest.Mock } }) => {
        const calls = r.value.createEl?.mock?.calls ?? [];
        return calls.some((c: unknown[]) => c[0] === 'button');
      }
    );
    expect(tabBarResult).toBeDefined();

    const tabBarEl = tabBarResult.value as { createEl: jest.Mock; addEventListener?: jest.Mock };
    // Find the Tags button call (index 1 - Folders=0, Tags=1, Links=2)
    const buttonCalls = tabBarEl.createEl.mock.calls.filter((c: unknown[]) => c[0] === 'button');
    expect(buttonCalls).toHaveLength(3);

    // Get the Tags button element (second button created)
    const tagsButtonEl = tabBarEl.createEl.mock.results.filter(
      (_: unknown, i: number) => tabBarEl.createEl.mock.calls[i]![0] === 'button'
    )[1]!.value as { addEventListener: jest.Mock };

    // Simulate clicking the Tags tab
    const clickHandler = tagsButtonEl.addEventListener.mock.calls.find(
      (c: unknown[]) => c[0] === 'click'
    )?.[1] as (() => void) | undefined;
    expect(clickHandler).toBeDefined();

    // Reset createDiv to track the re-render
    (view.contentEl.createDiv as jest.Mock).mockClear();
    clickHandler!();

    // After click, refresh was called - verify Tags panel content
    const newPanelContainer = (view.contentEl.createDiv as jest.Mock).mock.results[0]!.value;
    // Tags panel creates a "Generate for new tag" button
    const allElCalls: unknown[][] = [];
    for (const result of newPanelContainer.createDiv.mock.results) {
      const el = result.value as { createEl: jest.Mock };
      if (el.createEl?.mock?.calls) {
        allElCalls.push(...el.createEl.mock.calls);
      }
    }
    // Also check direct createEl on panel content div
    const panelContentEl = newPanelContainer.createDiv.mock.results.find(
      (r: { value: { createEl: jest.Mock } }) =>
        r.value.createEl?.mock?.calls?.some(
          (c: unknown[]) => c[0] === 'button' && (c[1] as { text?: string })?.text === 'Generate for new tag'
        )
    );
    expect(panelContentEl).toBeDefined();
  });

  it('active tab is restored from settings on construction', () => {
    const { view } = createTestSidebar({ activeTab: 'tags' });
    view.refresh();

    // When activeTab is 'tags', the tags panel is rendered
    // Verify: "Generate for new tag" button is created (Tags panel marker)
    const panelContainer = (view.contentEl.createDiv as jest.Mock).mock.results[0]!.value;

    // Collect all createEl calls across all divs in the panel
    function collectCreateElCalls(el: { createEl?: jest.Mock; createDiv?: jest.Mock }): unknown[][] {
      const calls: unknown[][] = [];
      if (el.createEl?.mock?.calls) {
        calls.push(...el.createEl.mock.calls);
      }
      if (el.createDiv?.mock?.results) {
        for (const r of el.createDiv.mock.results) {
          calls.push(...collectCreateElCalls(r.value));
        }
      }
      return calls;
    }

    const allCalls = collectCreateElCalls(panelContainer);
    const generateTagBtn = allCalls.find(
      (c) => c[0] === 'button' && (c[1] as { text?: string })?.text === 'Generate for new tag'
    );
    expect(generateTagBtn).toBeDefined();
  });

  it('Tags panel renders files found in _self-tests/tags/', () => {
    const tagFile = new TFile('_self-tests/tags/python.md');
    const { view } = createTestSidebar({
      activeTab: 'tags',
      vaultFiles: [tagFile],
    });
    view.refresh();

    const panelContainer = (view.contentEl.createDiv as jest.Mock).mock.results[0]!.value;

    // Collect all createSpan calls to find tag name 'python'
    function collectCreateSpanCalls(el: {
      createSpan?: jest.Mock;
      createDiv?: jest.Mock;
      createEl?: jest.Mock;
    }): unknown[][] {
      const calls: unknown[][] = [];
      if (el.createSpan?.mock?.calls) {
        calls.push(...el.createSpan.mock.calls);
      }
      if (el.createDiv?.mock?.results) {
        for (const r of el.createDiv.mock.results) {
          calls.push(...collectCreateSpanCalls(r.value));
        }
      }
      if (el.createEl?.mock?.results) {
        for (const r of el.createEl.mock.results) {
          calls.push(...collectCreateSpanCalls(r.value));
        }
      }
      return calls;
    }

    const allSpanCalls = collectCreateSpanCalls(panelContainer);
    const pythonSpan = allSpanCalls.find(
      (c) => (c[0] as { text?: string })?.text === 'python'
    );
    expect(pythonSpan).toBeDefined();
  });

  it('Links panel renders files found in _self-tests/links/', () => {
    const linkFile = new TFile('_self-tests/links/my-moc.md');
    const { view } = createTestSidebar({
      activeTab: 'links',
      vaultFiles: [linkFile],
    });
    view.refresh();

    const panelContainer = (view.contentEl.createDiv as jest.Mock).mock.results[0]!.value;

    function collectCreateSpanCalls(el: {
      createSpan?: jest.Mock;
      createDiv?: jest.Mock;
      createEl?: jest.Mock;
    }): unknown[][] {
      const calls: unknown[][] = [];
      if (el.createSpan?.mock?.calls) {
        calls.push(...el.createSpan.mock.calls);
      }
      if (el.createDiv?.mock?.results) {
        for (const r of el.createDiv.mock.results) {
          calls.push(...collectCreateSpanCalls(r.value));
        }
      }
      if (el.createEl?.mock?.results) {
        for (const r of el.createEl.mock.results) {
          calls.push(...collectCreateSpanCalls(r.value));
        }
      }
      return calls;
    }

    const allSpanCalls = collectCreateSpanCalls(panelContainer);
    const mocSpan = allSpanCalls.find(
      (c) => (c[0] as { text?: string })?.text === 'my-moc'
    );
    expect(mocSpan).toBeDefined();
  });

  it('Tags panel shows spinner when generatingTags has matching tag', () => {
    const tagFile = new TFile('_self-tests/tags/python.md');
    const { view } = createTestSidebar({
      activeTab: 'tags',
      vaultFiles: [tagFile],
      generatingTags: ['python'],
    });
    view.refresh();

    const panelContainer = (view.contentEl.createDiv as jest.Mock).mock.results[0]!.value;

    // Collect all createDiv calls to find spinner div
    function collectCreateDivCalls(el: {
      createDiv?: jest.Mock;
    }): unknown[][] {
      const calls: unknown[][] = [];
      if (el.createDiv?.mock?.calls) {
        calls.push(...el.createDiv.mock.calls);
        for (const r of el.createDiv.mock.results) {
          calls.push(...collectCreateDivCalls(r.value));
        }
      }
      return calls;
    }

    const allDivCalls = collectCreateDivCalls(panelContainer);
    const spinnerDiv = allDivCalls.find(
      (c) => (c[0] as { cls?: string })?.cls === 'active-recall-loading'
    );
    expect(spinnerDiv).toBeDefined();
  });

  it('Links panel shows spinner when generatingLinks has matching basename', () => {
    const linkFile = new TFile('_self-tests/links/my-moc.md');
    const { view } = createTestSidebar({
      activeTab: 'links',
      vaultFiles: [linkFile],
      generatingLinks: ['my-moc'],
    });
    view.refresh();

    const panelContainer = (view.contentEl.createDiv as jest.Mock).mock.results[0]!.value;

    function collectCreateDivCalls(el: {
      createDiv?: jest.Mock;
    }): unknown[][] {
      const calls: unknown[][] = [];
      if (el.createDiv?.mock?.calls) {
        calls.push(...el.createDiv.mock.calls);
        for (const r of el.createDiv.mock.results) {
          calls.push(...collectCreateDivCalls(r.value));
        }
      }
      return calls;
    }

    const allDivCalls = collectCreateDivCalls(panelContainer);
    const spinnerDiv = allDivCalls.find(
      (c) => (c[0] as { cls?: string })?.cls === 'active-recall-loading'
    );
    expect(spinnerDiv).toBeDefined();
  });

  it('renderSelfTestRow creates a trash button when file exists and not generating', () => {
    const tagFile = new TFile('_self-tests/tags/python.md');
    const { view } = createTestSidebar({
      activeTab: 'tags',
      vaultFiles: [tagFile],
    });
    view.refresh();

    const panelContainer = (view.contentEl.createDiv as jest.Mock).mock.results[0]!.value;

    function collectCreateElCalls(el: { createEl?: jest.Mock; createDiv?: jest.Mock }): unknown[][] {
      const calls: unknown[][] = [];
      if (el.createEl?.mock?.calls) calls.push(...el.createEl.mock.calls);
      if (el.createDiv?.mock?.results) {
        for (const r of el.createDiv.mock.results) calls.push(...collectCreateElCalls(r.value));
      }
      return calls;
    }

    const allElCalls = collectCreateElCalls(panelContainer);
    const trashBtn = allElCalls.find(
      (c) => c[0] === 'button' && (c[1] as { cls?: string })?.cls?.includes('active-recall-trash-btn')
    );
    expect(trashBtn).toBeDefined();
  });

  it('renderSelfTestRow does NOT create trash button when isGenerating is true', () => {
    const tagFile = new TFile('_self-tests/tags/python.md');
    const { view } = createTestSidebar({
      activeTab: 'tags',
      vaultFiles: [tagFile],
      generatingTags: ['python'],
    });
    view.refresh();

    const panelContainer = (view.contentEl.createDiv as jest.Mock).mock.results[0]!.value;

    function collectCreateElCalls(el: { createEl?: jest.Mock; createDiv?: jest.Mock }): unknown[][] {
      const calls: unknown[][] = [];
      if (el.createEl?.mock?.calls) calls.push(...el.createEl.mock.calls);
      if (el.createDiv?.mock?.results) {
        for (const r of el.createDiv.mock.results) calls.push(...collectCreateElCalls(r.value));
      }
      return calls;
    }

    const allElCalls = collectCreateElCalls(panelContainer);
    const trashBtn = allElCalls.find(
      (c) => c[0] === 'button' && (c[1] as { cls?: string })?.cls?.includes('active-recall-trash-btn')
    );
    expect(trashBtn).toBeUndefined();
  });

  it('renderSelfTestRow does NOT create trash button for placeholder rows (file is null)', () => {
    const { view } = createTestSidebar({
      activeTab: 'tags',
      generatingTags: ['newTag'],
    });
    view.refresh();

    const panelContainer = (view.contentEl.createDiv as jest.Mock).mock.results[0]!.value;

    function collectCreateElCalls(el: { createEl?: jest.Mock; createDiv?: jest.Mock }): unknown[][] {
      const calls: unknown[][] = [];
      if (el.createEl?.mock?.calls) calls.push(...el.createEl.mock.calls);
      if (el.createDiv?.mock?.results) {
        for (const r of el.createDiv.mock.results) calls.push(...collectCreateElCalls(r.value));
      }
      return calls;
    }

    const allElCalls = collectCreateElCalls(panelContainer);
    const trashBtn = allElCalls.find(
      (c) => c[0] === 'button' && (c[1] as { cls?: string })?.cls?.includes('active-recall-trash-btn')
    );
    expect(trashBtn).toBeUndefined();
  });
});

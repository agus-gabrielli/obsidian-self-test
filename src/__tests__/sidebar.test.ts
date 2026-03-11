import { TFile, TFolder, Menu, createMockApp } from '../__mocks__/obsidian';
import {
  getFolderStatuses,
  getLastGeneratedDate,
  buildContextMenuHandler,
  buildActivateView,
} from '../sidebar';

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

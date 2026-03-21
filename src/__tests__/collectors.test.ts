import { TFile, createMockApp, getAllTags } from '../__mocks__/obsidian';
import type { CachedMetadata } from '../__mocks__/obsidian';
import {
  collectNotesByTag,
  collectNotesByLinks,
  getAllVaultTags,
  buildTagOutputPath,
  buildLinksOutputPath,
  buildNoteOutputPath,
  writeOutputToPath,
  buildFrontmatter,
  isSelfTestFile,
} from '../collectors';
import type { CollectionSpec } from '../collectors';

// ────────────────────────────────────────────────────────────────────────────
// collectNotesByTag (COL-01, D-03)
// ────────────────────────────────────────────────────────────────────────────

describe('collectNotesByTag', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns files matching exact tag', () => {
    const app = createMockApp();
    const file1 = new TFile('notes/python.md');
    const file2 = new TFile('notes/python2.md');
    const file3 = new TFile('notes/rust.md');

    (app.vault.getFiles as jest.Mock).mockReturnValue([file1, file2, file3]);
    (app.metadataCache.getFileCache as jest.Mock).mockImplementation((file: TFile) => {
      if (file === file1 || file === file2) return { tags: [{ tag: '#python' }] };
      if (file === file3) return { tags: [{ tag: '#rust' }] };
      return null;
    });
    (getAllTags as jest.Mock).mockImplementation((cache: CachedMetadata | null) => {
      if (!cache?.tags) return [];
      return cache.tags.map((t) => t.tag);
    });

    const result = collectNotesByTag(app as any, 'python');
    expect(result).toHaveLength(2);
    expect(result).toContain(file1);
    expect(result).toContain(file2);
  });

  test('matches hierarchical children (D-03)', () => {
    const app = createMockApp();
    const langPython = new TFile('notes/lang-python.md');
    const langRust = new TFile('notes/lang-rust.md');
    const math = new TFile('notes/math.md');

    (app.vault.getFiles as jest.Mock).mockReturnValue([langPython, langRust, math]);
    (app.metadataCache.getFileCache as jest.Mock).mockImplementation((file: TFile) => {
      if (file === langPython) return { tags: [{ tag: '#lang/python' }] };
      if (file === langRust) return { tags: [{ tag: '#lang/rust' }] };
      if (file === math) return { tags: [{ tag: '#math' }] };
      return null;
    });
    (getAllTags as jest.Mock).mockImplementation((cache: CachedMetadata | null) => {
      if (!cache?.tags) return [];
      return cache.tags.map((t) => t.tag);
    });

    const result = collectNotesByTag(app as any, 'lang');
    expect(result).toHaveLength(2);
    expect(result).toContain(langPython);
    expect(result).toContain(langRust);
  });

  test('normalizes hash prefix in query', () => {
    const app = createMockApp();
    const file = new TFile('notes/python.md');

    (app.vault.getFiles as jest.Mock).mockReturnValue([file]);
    (app.metadataCache.getFileCache as jest.Mock).mockReturnValue({ tags: [{ tag: '#python' }] });
    (getAllTags as jest.Mock).mockReturnValue(['#python']);

    const result = collectNotesByTag(app as any, '#python');
    expect(result).toHaveLength(1);
    expect(result).toContain(file);
  });

  test('case-insensitive matching', () => {
    const app = createMockApp();
    const file = new TFile('notes/python.md');

    (app.vault.getFiles as jest.Mock).mockReturnValue([file]);
    (app.metadataCache.getFileCache as jest.Mock).mockReturnValue({ tags: [{ tag: '#Python' }] });
    (getAllTags as jest.Mock).mockReturnValue(['#Python']);

    const result = collectNotesByTag(app as any, 'python');
    expect(result).toHaveLength(1);
  });

  test('excludes self-test files from results', () => {
    const app = createMockApp();
    const regularFile = new TFile('notes/python.md');
    const selfTestFile = new TFile('_self-tests/tags/python.md');

    (app.vault.getFiles as jest.Mock).mockReturnValue([regularFile, selfTestFile]);
    (app.metadataCache.getFileCache as jest.Mock).mockImplementation((file: TFile) => {
      if (file === regularFile) return { tags: [{ tag: '#python' }] };
      if (file === selfTestFile) return { tags: [{ tag: '#python' }] };
      return null;
    });
    (getAllTags as jest.Mock).mockReturnValue(['#python']);

    const result = collectNotesByTag(app as any, 'python');
    expect(result).toContain(regularFile);
    expect(result).not.toContain(selfTestFile);
  });

  test('excludes _self-test basename files', () => {
    const app = createMockApp();
    const regularFile = new TFile('notes/python.md');
    const selfTestFile = new TFile('folder/_self-test.md');

    (app.vault.getFiles as jest.Mock).mockReturnValue([regularFile, selfTestFile]);
    (app.metadataCache.getFileCache as jest.Mock).mockImplementation((file: TFile) => {
      if (file === regularFile) return { tags: [{ tag: '#python' }] };
      if (file === selfTestFile) return { tags: [{ tag: '#python' }] };
      return null;
    });
    (getAllTags as jest.Mock).mockReturnValue(['#python']);

    const result = collectNotesByTag(app as any, 'python');
    expect(result).not.toContain(selfTestFile);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// getAllVaultTags (COL-02, D-04)
// ────────────────────────────────────────────────────────────────────────────

describe('getAllVaultTags', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns deduplicated tag counts', () => {
    const app = createMockApp();
    const file1 = new TFile('notes/a.md');
    const file2 = new TFile('notes/b.md');
    const file3 = new TFile('notes/c.md');

    (app.vault.getFiles as jest.Mock).mockReturnValue([file1, file2, file3]);
    (app.metadataCache.getFileCache as jest.Mock).mockImplementation((file: TFile) => {
      if (file === file1 || file === file2) return { tags: [{ tag: '#python' }] };
      if (file === file3) return { tags: [{ tag: '#rust' }] };
      return null;
    });
    (getAllTags as jest.Mock).mockImplementation((cache: CachedMetadata | null) => {
      if (!cache?.tags) return [];
      return cache.tags.map((t) => t.tag);
    });

    const result = getAllVaultTags(app as any);
    expect(result.get('python')).toBe(2);
    expect(result.get('rust')).toBe(1);
  });

  test('strips # prefix and lowercases', () => {
    const app = createMockApp();
    const file1 = new TFile('notes/a.md');
    const file2 = new TFile('notes/b.md');

    (app.vault.getFiles as jest.Mock).mockReturnValue([file1, file2]);
    (app.metadataCache.getFileCache as jest.Mock).mockImplementation((file: TFile) => {
      if (file === file1) return { tags: [{ tag: '#Python' }] };
      if (file === file2) return { tags: [{ tag: 'RUST' }] };
      return null;
    });
    (getAllTags as jest.Mock).mockImplementation((cache: CachedMetadata | null) => {
      if (!cache?.tags) return [];
      return cache.tags.map((t) => t.tag);
    });

    const result = getAllVaultTags(app as any);
    expect(result.get('python')).toBe(1);
    expect(result.get('rust')).toBe(1);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// collectNotesByLinks (COL-04, COL-05)
// ────────────────────────────────────────────────────────────────────────────

describe('collectNotesByLinks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('depth 1 returns root + direct links', () => {
    const app = createMockApp();
    const rootFile = new TFile('root.md');
    const fileA = new TFile('a.md');
    const fileB = new TFile('b.md');

    app.metadataCache.resolvedLinks = {
      'root.md': { 'a.md': 1, 'b.md': 1 },
    };
    (app.vault.getFileByPath as jest.Mock).mockImplementation((path: string) => {
      if (path === 'a.md') return fileA;
      if (path === 'b.md') return fileB;
      return null;
    });

    const result = collectNotesByLinks(app as any, rootFile, 1);
    expect(result).toHaveLength(3);
    expect(result).toContain(rootFile);
    expect(result).toContain(fileA);
    expect(result).toContain(fileB);
  });

  test('depth 2 returns root + depth-1 + depth-2', () => {
    const app = createMockApp();
    const rootFile = new TFile('root.md');
    const fileA = new TFile('a.md');
    const fileB = new TFile('b.md');
    const fileC = new TFile('c.md');

    app.metadataCache.resolvedLinks = {
      'root.md': { 'a.md': 1, 'b.md': 1 },
      'a.md': { 'c.md': 1 },
    };
    (app.vault.getFileByPath as jest.Mock).mockImplementation((path: string) => {
      if (path === 'a.md') return fileA;
      if (path === 'b.md') return fileB;
      if (path === 'c.md') return fileC;
      return null;
    });

    const result = collectNotesByLinks(app as any, rootFile, 2);
    expect(result).toHaveLength(4);
    expect(result).toContain(rootFile);
    expect(result).toContain(fileA);
    expect(result).toContain(fileB);
    expect(result).toContain(fileC);
  });

  test('does not revisit already-visited files', () => {
    const app = createMockApp();
    const rootFile = new TFile('root.md');
    const fileA = new TFile('a.md');

    app.metadataCache.resolvedLinks = {
      'root.md': { 'a.md': 1 },
      'a.md': { 'root.md': 1 },
    };
    (app.vault.getFileByPath as jest.Mock).mockImplementation((path: string) => {
      if (path === 'a.md') return fileA;
      if (path === 'root.md') return rootFile;
      return null;
    });

    const result = collectNotesByLinks(app as any, rootFile, 2);
    expect(result).toHaveLength(2);
    expect(result).toContain(rootFile);
    expect(result).toContain(fileA);
  });

  test('skips non-md files', () => {
    const app = createMockApp();
    const rootFile = new TFile('root.md');
    const image = new TFile('image.png', 'png');

    app.metadataCache.resolvedLinks = {
      'root.md': { 'image.png': 1 },
    };
    (app.vault.getFileByPath as jest.Mock).mockImplementation((path: string) => {
      if (path === 'image.png') return image;
      return null;
    });

    const result = collectNotesByLinks(app as any, rootFile, 1);
    expect(result).toHaveLength(1);
    expect(result).toContain(rootFile);
    expect(result).not.toContain(image);
  });

  test('excludes self-test files from link traversal', () => {
    const app = createMockApp();
    const rootFile = new TFile('root.md');
    const selfTestFile = new TFile('_self-tests/links/something.md');

    app.metadataCache.resolvedLinks = {
      'root.md': { '_self-tests/links/something.md': 1 },
    };
    (app.vault.getFileByPath as jest.Mock).mockImplementation((path: string) => {
      if (path === '_self-tests/links/something.md') return selfTestFile;
      return null;
    });

    const result = collectNotesByLinks(app as any, rootFile, 1);
    expect(result).toHaveLength(1);
    expect(result).toContain(rootFile);
    expect(result).not.toContain(selfTestFile);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Output path builders (COL-03, COL-07, D-09, D-10, D-15, D-16)
// ────────────────────────────────────────────────────────────────────────────

describe('buildTagOutputPath', () => {
  test("buildTagOutputPath('python') returns _self-tests/tags/python.md", () => {
    expect(buildTagOutputPath('python')).toBe('_self-tests/tags/python.md');
  });

  test("buildTagOutputPath('#lang/python') returns _self-tests/tags/lang/python.md", () => {
    expect(buildTagOutputPath('#lang/python')).toBe('_self-tests/tags/lang/python.md');
  });
});

describe('buildLinksOutputPath', () => {
  test('returns _self-tests/links/<basename>.md', () => {
    const rootFile = new TFile('notes/my-moc.md');
    expect(buildLinksOutputPath(rootFile)).toBe('_self-tests/links/my-moc.md');
  });
});

describe('buildNoteOutputPath', () => {
  test('same-folder mode returns note in same folder', () => {
    const file = new TFile('physics/newton.md');
    expect(buildNoteOutputPath(file, 'same-folder')).toBe('physics/newton_self-test.md');
  });

  test('same-folder root level (parent null) returns at root', () => {
    const file = new TFile('newton.md');
    expect(buildNoteOutputPath(file, 'same-folder')).toBe('newton_self-test.md');
  });

  test('centralized mode returns _self-tests/notes/<safe-name>.md', () => {
    const file = new TFile('physics/mechanics/newton.md');
    expect(buildNoteOutputPath(file, 'centralized')).toBe('_self-tests/notes/physics-mechanics-newton.md');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// writeOutputToPath
// ────────────────────────────────────────────────────────────────────────────

describe('writeOutputToPath', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('creates file when it does not exist', async () => {
    const app = createMockApp();
    (app.vault.getFileByPath as jest.Mock).mockReturnValue(null);

    await writeOutputToPath(app as any, 'folder/output.md', 'content');

    expect(app.vault.create).toHaveBeenCalledWith('folder/output.md', 'content');
    expect(app.vault.modify).not.toHaveBeenCalled();
  });

  test('modifies file when it exists', async () => {
    const app = createMockApp();
    const existingFile = new TFile('folder/output.md');
    (app.vault.getFileByPath as jest.Mock).mockReturnValue(existingFile);

    await writeOutputToPath(app as any, 'folder/output.md', 'new content');

    expect(app.vault.modify).toHaveBeenCalledWith(existingFile, 'new content');
    expect(app.vault.create).not.toHaveBeenCalled();
  });

  test('creates intermediate directories', async () => {
    const app = createMockApp();
    (app.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(null);
    (app.vault.getFileByPath as jest.Mock).mockReturnValue(null);

    await writeOutputToPath(app as any, '_self-tests/tags/lang/python.md', 'content');

    expect(app.vault.createFolder).toHaveBeenCalledWith('_self-tests');
    expect(app.vault.createFolder).toHaveBeenCalledWith('_self-tests/tags');
    expect(app.vault.createFolder).toHaveBeenCalledWith('_self-tests/tags/lang');
  });

  test('skips existing directories', async () => {
    const app = createMockApp();
    // _self-tests exists, others do not
    (app.vault.getAbstractFileByPath as jest.Mock).mockImplementation((path: string) => {
      if (path === '_self-tests') return { path: '_self-tests' };
      return null;
    });
    (app.vault.getFileByPath as jest.Mock).mockReturnValue(null);

    await writeOutputToPath(app as any, '_self-tests/tags/python.md', 'content');

    expect(app.vault.createFolder).not.toHaveBeenCalledWith('_self-tests');
    expect(app.vault.createFolder).toHaveBeenCalledWith('_self-tests/tags');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// isSelfTestFile
// ────────────────────────────────────────────────────────────────────────────

describe('isSelfTestFile', () => {
  test('returns true for _self-test basename', () => {
    expect(isSelfTestFile(new TFile('folder/_self-test.md'))).toBe(true);
  });

  test('returns true for files inside _self-tests/', () => {
    expect(isSelfTestFile(new TFile('_self-tests/tags/python.md'))).toBe(true);
  });

  test('returns false for regular note', () => {
    expect(isSelfTestFile(new TFile('folder/notes.md'))).toBe(false);
  });

  test('returns true for single-note self-test', () => {
    expect(isSelfTestFile(new TFile('folder/newton_self-test.md'))).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// buildFrontmatter (D-14)
// ────────────────────────────────────────────────────────────────────────────

describe('buildFrontmatter', () => {
  test('tag mode includes source_mode, source, source_notes', () => {
    const spec: CollectionSpec = { mode: 'tag', tag: 'python' };
    const files = [new TFile('notes/note1.md'), new TFile('notes/note2.md')];

    const result = buildFrontmatter(spec, files);
    expect(result).toContain('source_mode: tag');
    expect(result).toContain('source: "python"');
    expect(result).toContain('[[note1]]');
    expect(result).toContain('[[note2]]');
  });

  test('links mode uses root basename as source', () => {
    const rootFile = new TFile('notes/my-moc.md');
    const spec: CollectionSpec = { mode: 'links', rootFile, depth: 1 };
    const files = [rootFile];

    const result = buildFrontmatter(spec, files);
    expect(result).toContain('source_mode: links');
    expect(result).toContain('source: "my-moc"');
  });

  test('folder mode uses folder path as source', () => {
    const spec: CollectionSpec = { mode: 'folder', folderPath: 'my/folder' };
    const files: TFile[] = [];

    const result = buildFrontmatter(spec, files);
    expect(result).toContain('source_mode: folder');
    expect(result).toContain('source: "my/folder"');
  });
});

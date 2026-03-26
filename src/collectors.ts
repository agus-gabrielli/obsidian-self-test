import { App, TFile, getAllTags } from 'obsidian';

// ────────────────────────────────────────────────────────────────────────────
// CollectionSpec - discriminated union for all collection modes
// ────────────────────────────────────────────────────────────────────────────

export type CollectionSpec =
  | { mode: 'folder'; folderPath: string }
  | { mode: 'tag'; tag: string }
  | { mode: 'links'; rootFile: TFile; depth: 1 | 2 }
  | { mode: 'note'; file: TFile };

// ────────────────────────────────────────────────────────────────────────────
// isSelfTestFile
// ────────────────────────────────────────────────────────────────────────────

/**
 * Returns true if the file is a self-test output file that should be excluded
 * from note collection (to avoid feedback loops).
 */
export function isSelfTestFile(file: TFile): boolean {
    if (file.basename === '_self-test') return true;
    if (file.path.startsWith('_self-tests/')) return true;
    if (file.basename.endsWith('_self-test')) return true;
    return false;
}

// ────────────────────────────────────────────────────────────────────────────
// collectNotesByTag (COL-01, D-03)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Returns all vault .md files whose tags match the given tag (exact or as
 * hierarchical parent, e.g. 'lang' matches 'lang/python'). Case-insensitive.
 * Excludes self-test files.
 */
export function collectNotesByTag(app: App, tag: string): TFile[] {
    const normalizedTarget = tag.replace(/^#/, '').toLowerCase();

    return app.vault.getFiles().filter((file) => {
        if (file.extension !== 'md') return false;
        if (isSelfTestFile(file)) return false;

        const cache = app.metadataCache.getFileCache(file);
        const tags = cache ? (getAllTags(cache) ?? []) : [];

        return tags.some((t) => {
            const normalized = t.replace(/^#/, '').toLowerCase();
            return (
                normalized === normalizedTarget ||
                normalized.startsWith(normalizedTarget + '/')
            );
        });
    });
}

// ────────────────────────────────────────────────────────────────────────────
// getAllVaultTags (COL-02, D-04)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Returns a Map of tag -> count across all .md vault files.
 * Tags are normalized: # prefix stripped and lowercased.
 */
export function getAllVaultTags(app: App): Map<string, number> {
    const counts = new Map<string, number>();

    for (const file of app.vault.getFiles()) {
        if (file.extension !== 'md') continue;

        const cache = app.metadataCache.getFileCache(file);
        const tags = cache ? (getAllTags(cache) ?? []) : [];

        for (const t of tags) {
            const normalized = t.replace(/^#/, '').toLowerCase();
            counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
        }
    }

    return counts;
}

// ────────────────────────────────────────────────────────────────────────────
// collectNotesByLinks (COL-04, COL-05)
// ────────────────────────────────────────────────────────────────────────────

/**
 * BFS traversal of the resolved links graph starting from rootFile.
 * Collects notes up to the given depth (1 or 2), following both
 * outgoing links and backlinks (notes that link TO each visited node).
 * Excludes non-md files, self-test files, and already-visited nodes.
 */
export function collectNotesByLinks(
    app: App,
    rootFile: TFile,
    depth: 1 | 2
): TFile[] {
    const visited = new Set<string>([rootFile.path]);
    const result: TFile[] = [rootFile];
    const queue: Array<{ path: string; d: number }> = [{ path: rootFile.path, d: 0 }];

    while (queue.length > 0) {
        const item = queue.shift()!;
        if (item.d >= depth) continue;

        // Outgoing links
        const outgoing = app.metadataCache.resolvedLinks[item.path] ?? {};

        // Backlinks: files that link TO this node
        const backlinks: string[] = [];
        for (const [sourcePath, destinations] of Object.entries(app.metadataCache.resolvedLinks)) {
            if (item.path in destinations && !visited.has(sourcePath)) {
                backlinks.push(sourcePath);
            }
        }

        const allLinkedPaths = [...Object.keys(outgoing), ...backlinks];

        for (const linkedPath of allLinkedPaths) {
            if (visited.has(linkedPath)) continue;

            const linkedFile = app.vault.getFileByPath(linkedPath);
            if (!linkedFile) continue;
            if (linkedFile.extension !== 'md') continue;
            if (isSelfTestFile(linkedFile)) continue;

            visited.add(linkedPath);
            result.push(linkedFile);
            queue.push({ path: linkedPath, d: item.d + 1 });
        }
    }

    return result;
}

// ────────────────────────────────────────────────────────────────────────────
// Output path builders
// ────────────────────────────────────────────────────────────────────────────

/**
 * Builds the output path for tag-based generation.
 * '#lang/python' -> '_self-tests/tags/lang/python.md'
 */
export function buildTagOutputPath(tag: string): string {
    const normalized = tag.replace(/^#/, '');
    return `_self-tests/tags/${normalized}.md`;
}

/**
 * Builds the output path for links-based generation.
 * rootFile with basename 'my-moc' -> '_self-tests/links/my-moc.md'
 */
export function buildLinksOutputPath(rootFile: TFile): string {
    return `_self-tests/links/${rootFile.basename}.md`;
}

/**
 * Builds the output path for single-note generation.
 * 'same-folder': produces '<folder>/<basename>_self-test.md'
 * 'centralized': produces '_self-tests/notes/<path-with-dashes>.md'
 */
export function buildNoteOutputPath(
    file: TFile,
    mode: 'same-folder' | 'centralized'
): string {
    if (mode === 'same-folder') {
        const folder = file.parent?.path ?? '';
        return folder
            ? `${folder}/${file.basename}_self-test.md`
            : `${file.basename}_self-test.md`;
    }

    // centralized
    const safeName = file.path.replace(/\.md$/, '').replace(/\//g, '-');
    return `_self-tests/notes/${safeName}.md`;
}

// ────────────────────────────────────────────────────────────────────────────
// writeOutputToPath
// ────────────────────────────────────────────────────────────────────────────

/**
 * Creates intermediate directories as needed, then creates or modifies
 * the file at filePath with the given content.
 */
export async function writeOutputToPath(
    app: App,
    filePath: string,
    content: string
): Promise<void> {
    const segments = filePath.split('/');
    // Build each intermediate directory (exclude the filename at the end)
    for (let i = 1; i < segments.length; i++) {
        const dir = segments.slice(0, i).join('/');
        if (!app.vault.getAbstractFileByPath(dir)) {
            await app.vault.createFolder(dir);
        }
    }

    const existing = app.vault.getFileByPath(filePath);
    if (existing) {
        await app.vault.modify(existing, content);
    } else {
        await app.vault.create(filePath, content);
    }
}

// ────────────────────────────────────────────────────────────────────────────
// buildFrontmatter (D-14)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Returns a YAML frontmatter block with spaced-repetition metadata and
 * source traceability fields populated from the CollectionSpec.
 */
export function buildFrontmatter(spec: CollectionSpec, collectedFiles: TFile[]): string {
    const sourceNotes = collectedFiles
        .map((f) => {
            const display = f.basename;
            const fullPath = f.path.replace(/\.md$/, '');
            return `"[[${fullPath}|${display}]]"`;
        })
        .join(', ');

    let sourceMode: string;
    let source: string;

    switch (spec.mode) {
        case 'tag':
            sourceMode = 'tag';
            source = spec.tag;
            break;
        case 'links':
            sourceMode = 'links';
            source = spec.rootFile.basename;
            break;
        case 'note':
            sourceMode = 'note';
            source = spec.file.basename;
            break;
        case 'folder':
            sourceMode = 'folder';
            source = spec.folderPath;
            break;
    }

    return [
        '---',
        `source_mode: ${sourceMode}`,
        `source: "${source}"`,
        `source_notes: [${sourceNotes}]`,
        '---',
        '',
    ].join('\n');
}

import { App, SuggestModal, FuzzySuggestModal, TFile, TFolder, Modal, Notice } from 'obsidian';
import { getAllVaultTags, collectNotesByLinks, isSelfTestFile } from './collectors';

export class TagPickerModal extends SuggestModal<string> {
    private tagCounts: Map<string, number>;
    private onSelect: (tag: string) => void;

    constructor(app: App, onSelect: (tag: string) => void) {
        super(app);
        this.tagCounts = getAllVaultTags(app);
        this.onSelect = onSelect;
        this.setPlaceholder('Search tags...');
    }

    getSuggestions(query: string): string[] {
        const q = query.toLowerCase().replace(/^#/, '');
        const tags = Array.from(this.tagCounts.keys());
        if (!q) return this.sortTagsGrouped(tags);
        return this.sortTagsGrouped(tags.filter(tag => tag.includes(q)));
    }

    /**
     * Sort tags so nested tags appear after their parent, with visual grouping.
     * Per D-01: parent tags group children. Implementation: alphabetical sort
     * naturally groups hierarchical tags (lang, lang/python, lang/rust).
     */
    private sortTagsGrouped(tags: string[]): string[] {
        return tags.sort((a, b) => a.localeCompare(b));
    }

    renderSuggestion(tag: string, el: HTMLElement): void {
        const depth = tag.split('/').length - 1;
        const displayName = depth > 0 ? tag.split('/').pop()! : tag;
        const container = el.createDiv({ cls: 'self-test-tag-suggestion' });
        if (depth > 0) {
            container.style.paddingLeft = `${depth * 16}px`;
        }
        container.createSpan({ text: depth > 0 ? displayName : tag });
        const count = this.tagCounts.get(tag) ?? 0;
        container.createSpan({ text: ` (${count})`, cls: 'self-test-tag-count' });
    }

    onChooseSuggestion(tag: string): void {
        this.onSelect(tag);
    }
}

export class FolderPickerModal extends SuggestModal<TFolder> {
    private folders: TFolder[];
    private onSelect: (folderPath: string) => void;

    constructor(app: App, onSelect: (folderPath: string) => void) {
        super(app);
        this.onSelect = onSelect;
        this.setPlaceholder('Search folders...');
        // Eligible folders: have at least one non-self-test .md file
        this.folders = (app as App).vault.getAllFolders(false).filter((folder: TFolder) => {
            if (folder.path === '_self-tests' || folder.path.startsWith('_self-tests/')) return false;
            return folder.children.some(
                (child) =>
                    child instanceof TFile &&
                    child.extension === 'md' &&
                    child.basename !== '_self-test'
            );
        });
    }

    getSuggestions(query: string): TFolder[] {
        const q = query.toLowerCase();
        if (!q) return this.folders;
        return this.folders.filter((folder) => folder.path.toLowerCase().includes(q));
    }

    renderSuggestion(folder: TFolder, el: HTMLElement): void {
        el.createSpan({ text: folder.path });
    }

    onChooseSuggestion(folder: TFolder): void {
        this.onSelect(folder.path);
    }
}

export class NotePickerModal extends FuzzySuggestModal<TFile> {
    private onSelect: (file: TFile) => void;

    constructor(app: App, onSelect: (file: TFile) => void) {
        super(app);
        this.onSelect = onSelect;
        this.setPlaceholder('Pick a note...');
    }

    getItems(): TFile[] {
        return this.app.vault.getFiles().filter(
            (f: TFile) => f.extension === 'md' && !isSelfTestFile(f)
        );
    }

    getItemText(file: TFile): string {
        return file.basename;
    }

    renderSuggestion(match: { item: TFile }, el: HTMLElement): void {
        const file = match.item;
        const container = el.createDiv({ cls: 'self-test-note-suggestion' });
        container.createDiv({ text: file.basename, cls: 'self-test-note-name' });
        // Per D-10: dimmed path underneath basename, matching Quick Switcher pattern
        const parentPath = file.parent ? file.parent.path : '';
        if (parentPath && parentPath !== '/') {
            container.createDiv({ text: parentPath, cls: 'self-test-note-path' });
        }
    }

    onChooseItem(file: TFile): void {
        this.onSelect(file);
    }
}

export class LinkConfirmModal extends Modal {
    private rootFile: TFile;
    private depth: 1 | 2 = 1;
    private onGenerate: (file: TFile, depth: 1 | 2) => void;
    private onReopen: () => void;

    constructor(
        app: App,
        rootFile: TFile,
        onGenerate: (file: TFile, depth: 1 | 2) => void,
        onReopen: () => void
    ) {
        super(app);
        this.rootFile = rootFile;
        this.onGenerate = onGenerate;
        this.onReopen = onReopen;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h3', { text: 'Generate from linked notes' });
        contentEl.createEl('p', { text: `Root note: ${this.rootFile.basename}` });

        // Per D-12: check for zero links before showing full UI
        const outgoing = (this.app as App).metadataCache.resolvedLinks[this.rootFile.path] ?? {};
        const hasOutgoing = Object.keys(outgoing).length > 0;
        const hasBacklinks = Object.values((this.app as App).metadataCache.resolvedLinks)
            .some(dests => this.rootFile.path in dests);

        if (!hasOutgoing && !hasBacklinks) {
            new Notice('This note has no linked notes. Try a different note.');
            this.close();
            // Loop back to step 1
            this.onReopen();
            return;
        }

        // Depth toggle
        const checkboxContainer = contentEl.createDiv({ cls: 'self-test-depth-toggle' });
        const checkbox = checkboxContainer.createEl('input', { type: 'checkbox' });
        checkbox.id = 'depth-2-toggle';
        const label = checkboxContainer.createEl('label', { text: ' Include links of links (depth 2)' });
        label.setAttribute('for', 'depth-2-toggle');

        // Preview count
        const previewEl = contentEl.createEl('p', { cls: 'self-test-link-preview' });
        const updatePreview = () => {
            const collected = collectNotesByLinks(this.app as App, this.rootFile, this.depth);
            previewEl.setText(`${collected.length} note${collected.length === 1 ? '' : 's'} will be collected.`);
        };
        updatePreview();

        checkbox.addEventListener('change', () => {
            this.depth = checkbox.checked ? 2 : 1;
            updatePreview();
        });

        // Generate button
        const generateBtn = contentEl.createEl('button', {
            text: 'Generate',
            cls: 'mod-cta self-test-generate-btn',
        });
        generateBtn.addEventListener('click', () => {
            this.onGenerate(this.rootFile, this.depth);
            this.close();
        });
    }

    onClose(): void {
        this.contentEl.empty();
    }
}

export function openLinkedNotesPicker(
    app: App,
    onGenerate: (file: TFile, depth: 1 | 2) => void
): void {
    const picker = new NotePickerModal(app, (file: TFile) => {
        new LinkConfirmModal(app, file, onGenerate, () => {
            openLinkedNotesPicker(app, onGenerate);
        }).open();
    });
    picker.open();
}

export class DeleteConfirmModal extends Modal {
    private filePath: string;
    private onConfirm: () => void;

    constructor(app: App, filePath: string, onConfirm: () => void) {
        super(app);
        this.filePath = filePath;
        this.onConfirm = onConfirm;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h3', { text: 'Delete self-test?' });
        contentEl.createEl('p', { text: `This will delete: ${this.filePath}` });

        const btnContainer = contentEl.createDiv({ cls: 'self-test-confirm-buttons' });

        const cancelBtn = btnContainer.createEl('button', { text: 'Cancel' });
        cancelBtn.addEventListener('click', () => this.close());

        const deleteBtn = btnContainer.createEl('button', {
            text: 'Delete',
            cls: 'mod-warning',
        });
        deleteBtn.addEventListener('click', () => {
            this.onConfirm();
            this.close();
        });
    }

    onClose(): void {
        this.contentEl.empty();
    }
}

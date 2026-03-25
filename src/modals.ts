import { App, SuggestModal, TFile, TFolder, Modal, Notice } from 'obsidian';
import { getAllVaultTags, collectNotesByLinks } from './collectors';

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
        const container = el.createDiv({ cls: 'active-recall-tag-suggestion' });
        if (depth > 0) {
            container.style.paddingLeft = `${depth * 16}px`;
        }
        container.createSpan({ text: depth > 0 ? displayName : tag });
        const count = this.tagCounts.get(tag) ?? 0;
        container.createSpan({ text: ` (${count})`, cls: 'active-recall-tag-count' });
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

export class LinkedNotesPickerModal extends Modal {
    private depth: 1 | 2 = 1;
    private selectedFile: TFile | null = null;
    private previewEl: HTMLElement;
    private resultListEl: HTMLElement;
    private generateBtn: HTMLButtonElement;
    private onGenerate: (file: TFile, depth: 1 | 2) => void;

    constructor(app: App, onGenerate: (file: TFile, depth: 1 | 2) => void) {
        super(app);
        this.onGenerate = onGenerate;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h3', { text: 'Generate Self-Test from Linked Notes' });

        // Search input (D-05: type to search across all vault notes)
        const searchInput = contentEl.createEl('input', {
            type: 'text',
            placeholder: 'Search notes...',
            cls: 'active-recall-link-search',
        });
        searchInput.style.width = '100%';
        searchInput.style.marginBottom = '8px';

        // Result list
        this.resultListEl = contentEl.createDiv({ cls: 'active-recall-link-results' });
        this.resultListEl.style.maxHeight = '200px';
        this.resultListEl.style.overflowY = 'auto';
        this.resultListEl.style.marginBottom = '8px';

        // Depth-2 checkbox (D-06)
        const checkboxContainer = contentEl.createDiv({ cls: 'active-recall-depth-toggle' });
        const checkbox = checkboxContainer.createEl('input', { type: 'checkbox' });
        checkbox.id = 'depth-2-toggle';
        const label = checkboxContainer.createEl('label', { text: ' Include links of links (depth 2)' });
        label.setAttribute('for', 'depth-2-toggle');
        checkbox.addEventListener('change', () => {
            this.depth = checkbox.checked ? 2 : 1;
            this.updatePreview();
        });

        // Preview count (D-08)
        this.previewEl = contentEl.createEl('p', {
            text: 'Select a note above.',
            cls: 'active-recall-link-preview',
        });

        // Generate button (disabled until selection)
        this.generateBtn = contentEl.createEl('button', {
            text: 'Generate',
            cls: 'mod-cta active-recall-generate-btn',
        });
        this.generateBtn.disabled = true;
        this.generateBtn.addEventListener('click', () => {
            if (!this.selectedFile) return;
            // D-07: If no outgoing links or backlinks, show notice and abort
            const outgoing = (this.app as App).metadataCache.resolvedLinks[this.selectedFile.path] ?? {};
            const hasOutgoing = Object.keys(outgoing).length > 0;
            const hasBacklinks = Object.values((this.app as App).metadataCache.resolvedLinks)
                .some(dests => this.selectedFile!.path in dests);
            if (!hasOutgoing && !hasBacklinks) {
                new Notice('This note has no linked notes. Try a different note.');
                return;
            }
            this.onGenerate(this.selectedFile, this.depth);
            this.close();
        });

        // Wire up search
        searchInput.addEventListener('input', () => {
            this.renderResults(searchInput.value);
        });

        // Initial render: show all notes
        this.renderResults('');
        searchInput.focus();
    }

    private renderResults(query: string): void {
        this.resultListEl.empty();
        const q = query.toLowerCase();
        const files = (this.app as App).vault.getFiles()
            .filter((f: TFile) => f.extension === 'md')
            .filter((f: TFile) => !q || f.basename.toLowerCase().includes(q))
            .slice(0, 50); // Cap at 50 results for performance

        for (const file of files) {
            const row = this.resultListEl.createDiv({ cls: 'active-recall-link-result-row' });
            row.createSpan({ text: file.basename });
            row.createSpan({ text: ` - ${file.path}`, cls: 'active-recall-link-path' });
            row.addEventListener('click', () => {
                // Deselect previous
                this.resultListEl.querySelectorAll('.is-selected').forEach(el => el.removeClass('is-selected'));
                row.addClass('is-selected');
                this.selectedFile = file;
                this.generateBtn.disabled = false;
                this.updatePreview();
            });
        }
    }

    private updatePreview(): void {
        if (!this.selectedFile) {
            this.previewEl.setText('Select a note above.');
            return;
        }
        const collected = collectNotesByLinks(this.app as App, this.selectedFile, this.depth);
        this.previewEl.setText(`${collected.length} note${collected.length === 1 ? '' : 's'} will be collected.`);
    }

    onClose(): void {
        this.contentEl.empty();
    }
}

import { App, Notice, Plugin, TFile } from 'obsidian';
import { ActiveRecallSettings, DEFAULT_SETTINGS, ActiveRecallSettingTab, migrateV1Settings } from './settings';
import { GenerationService } from './generation';
import { VIEW_TYPE_ACTIVE_RECALL, ActiveRecallSidebarView, ActiveTab, buildActivateView, buildContextMenuHandler } from './sidebar';
import { TagPickerModal, LinkedNotesPickerModal } from './modals';
import { isSelfTestFile } from './collectors';

function getSidebarView(app: import('obsidian').App): ActiveRecallSidebarView | null {
    const leaves = app.workspace.getLeavesOfType(VIEW_TYPE_ACTIVE_RECALL);
    if (leaves.length > 0) {
        const view = leaves[0]?.view as ActiveRecallSidebarView | undefined;
        if (view && typeof view.refresh === 'function') return view;
    }
    return null;
}

function refreshSidebarIfOpen(app: import('obsidian').App): void {
    getSidebarView(app)?.refresh();
}

async function openSidebarWithTab(app: App, plugin: ActiveRecallPlugin, tab: ActiveTab): Promise<void> {
    plugin.settings.activeTab = tab;
    await plugin.saveSettings();
    const activateView = buildActivateView(app);
    await activateView();
    // After sidebar is open, refresh to show the generating state
    setTimeout(() => refreshSidebarIfOpen(app), 100);
}

export default class ActiveRecallPlugin extends Plugin {
    settings: ActiveRecallSettings;

    async onload() {
        await this.loadSettings();
        this.addSettingTab(new ActiveRecallSettingTab(this.app, this));

        const statusBarItem = this.addStatusBarItem();
        statusBarItem.setText('');
        const generationService = new GenerationService(this.app, this.settings, statusBarItem);

        this.registerView(
            VIEW_TYPE_ACTIVE_RECALL,
            (leaf) => new ActiveRecallSidebarView(leaf, this.app, this, generationService)
        );

        const activateView = buildActivateView(this.app);

        this.addCommand({
            id: 'open-active-recall-panel',
            name: 'Open Active Recall Panel',
            callback: () => activateView(),
        });

        this.registerEvent(
            this.app.workspace.on(
                'file-menu',
                buildContextMenuHandler(async (folderPath: string) => {
                    await openSidebarWithTab(this.app, this, 'folders');
                    const sidebar = getSidebarView(this.app);
                    if (sidebar) {
                        await sidebar.generateForFolder(folderPath);
                    } else {
                        await generationService.generate({ mode: 'folder', folderPath });
                        refreshSidebarIfOpen(this.app);
                    }
                })
            )
        );

        this.addRibbonIcon('brain-circuit', 'Open Active Recall Panel', () => {
            activateView();
        });

        this.addCommand({
            id: 'generate-self-test',
            name: 'Generate Self-Test for Current Folder',
            callback: async () => {
                const activeFile = this.app.workspace.getActiveFile();
                if (!activeFile) {
                    new Notice('Open a file inside the folder you want to generate a self-test for.');
                    return;
                }
                const folderPath = activeFile.parent?.path ?? '/';
                await openSidebarWithTab(this.app, this, 'folders');
                const sidebar = getSidebarView(this.app);
                if (sidebar) {
                    await sidebar.generateForFolder(folderPath);
                } else {
                    await generationService.generate({ mode: 'folder', folderPath });
                    refreshSidebarIfOpen(this.app);
                }
            },
        });

        this.addCommand({
            id: 'generate-self-test-by-tag',
            name: 'Generate Self-Test by Tag',
            callback: () => {
                new TagPickerModal(this.app, async (tag: string) => {
                    await openSidebarWithTab(this.app, this, 'tags');
                    const sidebar = getSidebarView(this.app);
                    if (sidebar) {
                        await sidebar.generateForTag(tag);
                    } else {
                        await generationService.generate({ mode: 'tag', tag });
                        refreshSidebarIfOpen(this.app);
                    }
                }).open();
            },
        });

        this.addCommand({
            id: 'generate-self-test-from-links',
            name: 'Generate Self-Test from Linked Notes',
            callback: () => {
                new LinkedNotesPickerModal(this.app, async (file: TFile, depth: 1 | 2) => {
                    await openSidebarWithTab(this.app, this, 'links');
                    const sidebar = getSidebarView(this.app);
                    if (sidebar) {
                        await sidebar.generateForLinks(file, depth);
                    } else {
                        await generationService.generate({ mode: 'links', rootFile: file, depth });
                        refreshSidebarIfOpen(this.app);
                    }
                }).open();
            },
        });

        this.addCommand({
            id: 'generate-self-test-for-note',
            name: 'Generate Self-Test for Current Note',
            callback: async () => {
                const activeFile = this.app.workspace.getActiveFile();
                if (!activeFile) {
                    new Notice('Open a note first.');
                    return;
                }
                if (isSelfTestFile(activeFile)) {
                    new Notice('Cannot generate a self-test from a self-test file.');
                    return;
                }
                await generationService.generate({ mode: 'note', file: activeFile });
                refreshSidebarIfOpen(this.app);
            },
        });

        this.registerEvent(
            this.app.workspace.on('file-menu', (menu, file) => {
                if (!(file instanceof TFile)) return;
                if (file.extension !== 'md') return;
                if (isSelfTestFile(file)) return;

                menu.addItem(item =>
                    item
                        .setTitle('Generate Self-Test')
                        .setIcon('brain-circuit')
                        .onClick(async () => {
                            await generationService.generate({ mode: 'note', file });
                            refreshSidebarIfOpen(this.app);
                        })
                );
            })
        );

        this.registerEvent(
            this.app.vault.on('create', (file) => {
                if (file instanceof TFile && (file.basename === '_self-test' || file.path.startsWith('_self-tests/') || file.basename.endsWith('_self-test'))) {
                    refreshSidebarIfOpen(this.app);
                }
            })
        );

        this.registerEvent(
            this.app.vault.on('delete', (file) => {
                if (file instanceof TFile && (file.basename === '_self-test' || file.path.startsWith('_self-tests/') || file.basename.endsWith('_self-test'))) {
                    refreshSidebarIfOpen(this.app);
                }
            })
        );
    }

    onunload() {
        this.app.workspace.detachLeavesOfType(VIEW_TYPE_ACTIVE_RECALL);
    }

    async loadSettings() {
        const savedData = ((await this.loadData()) ?? {}) as Record<string, unknown>;
        migrateV1Settings(savedData);
        this.settings = Object.assign({}, DEFAULT_SETTINGS, savedData) as ActiveRecallSettings;
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}

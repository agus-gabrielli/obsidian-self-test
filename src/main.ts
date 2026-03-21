import { Notice, Plugin, TFile } from 'obsidian';
import { ActiveRecallSettings, DEFAULT_SETTINGS, ActiveRecallSettingTab, migrateV1Settings } from './settings';
import { GenerationService } from './generation';
import { VIEW_TYPE_ACTIVE_RECALL, ActiveRecallSidebarView, buildActivateView, buildContextMenuHandler } from './sidebar';

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
            (leaf) => new ActiveRecallSidebarView(leaf, this.app, generationService)
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
                buildContextMenuHandler((folderPath: string) => {
                    const sidebar = getSidebarView(this.app);
                    if (sidebar) return sidebar.generateForFolder(folderPath);
                    return generationService.generate({ mode: 'folder', folderPath }).then(() => refreshSidebarIfOpen(this.app));
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
                const sidebar = getSidebarView(this.app);
                if (sidebar) {
                    await sidebar.generateForFolder(folderPath);
                } else {
                    await generationService.generate({ mode: 'folder', folderPath });
                    refreshSidebarIfOpen(this.app);
                }
            },
        });

        this.registerEvent(
            this.app.vault.on('create', (file) => {
                if (file instanceof TFile && file.basename === '_self-test') {
                    refreshSidebarIfOpen(this.app);
                }
            })
        );

        this.registerEvent(
            this.app.vault.on('delete', (file) => {
                if (file instanceof TFile && file.basename === '_self-test') {
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

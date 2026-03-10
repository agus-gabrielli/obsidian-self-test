import { Notice, Plugin } from 'obsidian';
import { ActiveRecallSettings, DEFAULT_SETTINGS, ActiveRecallSettingTab } from './settings';
import { GenerationService } from './generation';

export default class ActiveRecallPlugin extends Plugin {
    settings: ActiveRecallSettings;

    async onload() {
        await this.loadSettings();
        this.addSettingTab(new ActiveRecallSettingTab(this.app, this));

        const statusBarItem = this.addStatusBarItem();
        statusBarItem.setText('');
        const generationService = new GenerationService(this.app, this.settings, statusBarItem);

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
                await generationService.generate(folderPath);
            },
        });
    }

    onunload() {}

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<ActiveRecallSettings>);
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}

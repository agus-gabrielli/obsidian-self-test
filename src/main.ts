import { Plugin, Notice, requestUrl } from 'obsidian';
import { ActiveRecallSettings, DEFAULT_SETTINGS, ActiveRecallSettingTab } from './settings';

export default class ActiveRecallPlugin extends Plugin {
    settings: ActiveRecallSettings;

    async onload() {
        await this.loadSettings();
        this.addSettingTab(new ActiveRecallSettingTab(this.app, this));

        // Smoke test - establishes requestUrl() pattern; remove before Phase 2
        try {
            const resp = await requestUrl({ url: 'https://httpbin.org/get', throw: false });
            console.log('[ActiveRecall] requestUrl smoke test status:', resp.status);
            new Notice(`requestUrl smoke test: ${resp.status}`);
        } catch (e) {
            console.error('[ActiveRecall] requestUrl smoke test failed:', e);
            new Notice('requestUrl smoke test FAILED - see console');
        }
    }

    onunload() {}

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<ActiveRecallSettings>);
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}

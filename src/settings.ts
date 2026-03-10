import { App, PluginSettingTab } from 'obsidian';
import type ActiveRecallPlugin from './main';

export interface ActiveRecallSettings {
    // Phase 2 fills this in
}

export const DEFAULT_SETTINGS: ActiveRecallSettings = {};

export class ActiveRecallSettingTab extends PluginSettingTab {
    plugin: ActiveRecallPlugin;

    constructor(app: App, plugin: ActiveRecallPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        // Phase 2 fills this in
    }
}

import { App, PluginSettingTab, Setting } from 'obsidian';
import type ActiveRecallPlugin from './main';

export type LLMProvider = 'openai';

const CURATED_MODELS: string[] = [
    'gpt-5.4',
    'gpt-5.4-mini',
    'gpt-5.4-nano',
    'gpt-4.1',
    'gpt-4.1-mini',
    'gpt-4.1-nano',
    'gpt-4o',
    'gpt-4o-mini',
];
const CUSTOM_MODEL_VALUE = '__custom__';

export interface ActiveRecallSettings {
    provider: LLMProvider;
    apiKey: string;
    model: string;
    language: string;
    generateHints: boolean;
    generateReferenceAnswers: boolean;
    generateConceptMap: boolean;
    customInstructions: string;
}

export const DEFAULT_SETTINGS: ActiveRecallSettings = {
    provider: 'openai',
    apiKey: '',
    model: 'gpt-5.4-mini',
    language: '',
    generateHints: true,
    generateReferenceAnswers: true,
    generateConceptMap: true,
    customInstructions: '',
};

export class ActiveRecallSettingTab extends PluginSettingTab {
    plugin: ActiveRecallPlugin;
    private showCustomInput = false;

    constructor(app: App, plugin: ActiveRecallPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        // Connection section
        new Setting(containerEl).setName('Connection').setHeading();

        new Setting(containerEl)
            .setName('Provider')
            .setDesc('Additional providers (Anthropic, custom endpoint) will be available in a future version.')
            .addDropdown(drop => drop
                .addOption('openai', 'OpenAI')
                .setValue(this.plugin.settings.provider)
            )
            .setDisabled(true);

        new Setting(containerEl)
            .setName('API Key')
            .setDesc('Stored in data.json inside your vault. Do not commit this file to a public git repository.')
            .addText(text => {
                text.inputEl.type = 'password';
                text
                    .setPlaceholder('sk-...')
                    .setValue(this.plugin.settings.apiKey)
                    .onChange(async (value) => {
                        this.plugin.settings.apiKey = value;
                        await this.plugin.saveSettings();
                    });
            });

        // Determine if current model is in the curated list
        const isCustomModel = !CURATED_MODELS.includes(this.plugin.settings.model)
            || this.plugin.settings.model === '';
        if (isCustomModel) this.showCustomInput = true;

        new Setting(containerEl)
            .setName('Model')
            .setDesc('OpenAI model to use for generation.')
            .addDropdown(drop => {
                for (const m of CURATED_MODELS) {
                    drop.addOption(m, m);
                }
                drop.addOption(CUSTOM_MODEL_VALUE, 'Custom model...');
                drop.setValue(this.showCustomInput ? CUSTOM_MODEL_VALUE : this.plugin.settings.model);
                drop.onChange(async (value) => {
                    if (value === CUSTOM_MODEL_VALUE) {
                        this.showCustomInput = true;
                        this.display();
                        return;
                    }
                    this.showCustomInput = false;
                    this.plugin.settings.model = value;
                    await this.plugin.saveSettings();
                    this.display();
                });
            });

        // Show custom model text input when custom is selected
        if (this.showCustomInput) {
            new Setting(containerEl)
                .setName('Custom model name')
                .setDesc('Enter the exact OpenAI model identifier.')
                .addText(text => text
                    .setPlaceholder('e.g. gpt-4o-2024-08-06')
                    .setValue(isCustomModel ? this.plugin.settings.model : '')
                    .onChange(async (value) => {
                        this.plugin.settings.model = value;
                        await this.plugin.saveSettings();
                    })
                );
        }

        // Output section
        new Setting(containerEl).setName('Output').setHeading();

        new Setting(containerEl)
            .setName('Language')
            .setDesc("Leave empty to match the language of your notes automatically. Enter a language name (e.g. 'Spanish', 'Japanese') to override.")
            .addText(text => text
                .setPlaceholder('e.g. Spanish')
                .setValue(this.plugin.settings.language)
                .onChange(async (value) => {
                    this.plugin.settings.language = value;
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName('Generate hints')
            .setDesc('Include a collapsible hint for each question.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.generateHints)
                .onChange(async (value) => {
                    this.plugin.settings.generateHints = value;
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName('Generate reference answers')
            .setDesc('Include a collapsible reference answer for each question.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.generateReferenceAnswers)
                .onChange(async (value) => {
                    this.plugin.settings.generateReferenceAnswers = value;
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName('Generate concept map')
            .setDesc('Include a brief concept map before the questions when content supports it.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.generateConceptMap)
                .onChange(async (value) => {
                    this.plugin.settings.generateConceptMap = value;
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName('Custom instructions')
            .setDesc('Optional. Appended to the LLM prompt.')
            .addTextArea(text => {
                text
                    .setPlaceholder("Optional. Appended to the LLM prompt. Example: 'Focus on practical applications.'")
                    .setValue(this.plugin.settings.customInstructions);
                text.inputEl.addEventListener('blur', async () => {
                    this.plugin.settings.customInstructions = text.getValue();
                    await this.plugin.saveSettings();
                });
            });
    }
}

import { App, TFile, TFolder, Notice, requestUrl } from 'obsidian';
import { ActiveRecallSettings, LLMProvider, PROVIDER_CONFIG } from './settings';
import {
    CollectionSpec,
    collectNotesByTag,
    collectNotesByLinks,
    buildTagOutputPath,
    buildLinksOutputPath,
    buildNoteOutputPath,
    writeOutputToPath,
    buildFrontmatter,
    isSelfTestFile,
} from './collectors';
import {
    SYSTEM_MESSAGE,
    batchTemplate,
    synthesisTemplate,
    render,
    buildConceptMapInstruction,
    buildHintInstruction,
    buildCheckInstruction,
    buildLanguageInstruction,
    buildCustomInstruction,
} from './prompts';

export interface NoteSource {
    name: string;      // basename without extension
    content: string;   // full text content
}

// Token budget constants - tunable
export const INPUT_BUDGET_CHARS = 488_000;  // ~122k tokens at chars/4 heuristic

export function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
}

export function collectNoteFiles(app: App, folderPath: string): TFile[] {
    const item = app.vault.getAbstractFileByPath(folderPath);
    if (!(item instanceof TFolder)) return [];

    return item.children.filter(
        (child): child is TFile =>
            child instanceof TFile &&
            child.extension === 'md' &&
            !isSelfTestFile(child)
    );
}

export async function readNotes(app: App, files: TFile[]): Promise<NoteSource[]> {
    return Promise.all(
        files.map(async (file) => ({
            name: file.basename,
            content: await app.vault.read(file),
        }))
    );
}

export function splitIntoBatches(notes: NoteSource[]): NoteSource[][] {
    const batches: NoteSource[][] = [];
    let currentBatch: NoteSource[] = [];
    let currentChars = 0;

    for (const note of notes) {
        if (currentChars + note.content.length > INPUT_BUDGET_CHARS && currentBatch.length > 0) {
            batches.push(currentBatch);
            currentBatch = [];
            currentChars = 0;
        }
        currentBatch.push(note);
        currentChars += note.content.length;
    }

    if (currentBatch.length > 0) {
        batches.push(currentBatch);
    }

    return batches;
}

export function buildBatchPrompt(notes: NoteSource[], settings: ActiveRecallSettings): string {
    const noteBlocks = notes
        .map((n) => `=== Note: ${n.name} ===\n${n.content}`)
        .join('\n\n');

    const vars = {
        noteBlocks,
        conceptMapInstruction: buildConceptMapInstruction(settings.generateConceptMap),
        hintInstruction: buildHintInstruction(settings.generateHints),
        checkInstruction: buildCheckInstruction(settings.generateReferenceAnswers),
        languageInstruction: buildLanguageInstruction(settings.language),
        customInstruction: buildCustomInstruction(settings.customInstructions),
    };

    return render(batchTemplate, vars);
}

export function buildSynthesisPrompt(partialOutputs: string[], settings: ActiveRecallSettings): string {
    const noteBlocks = partialOutputs
        .map((output, i) => `=== Partial Output ${i + 1} ===\n${output}`)
        .join('\n\n');

    const vars = {
        noteBlocks,
        conceptMapInstruction: buildConceptMapInstruction(settings.generateConceptMap),
        hintInstruction: buildHintInstruction(settings.generateHints),
        checkInstruction: buildCheckInstruction(settings.generateReferenceAnswers),
        languageInstruction: buildLanguageInstruction(settings.language),
        customInstruction: buildCustomInstruction(settings.customInstructions),
    };

    return render(synthesisTemplate, vars);
}

export function buildMessages(
    systemMessage: string,
    userMessage: string
): Array<{ role: 'system' | 'user'; content: string }> {
    return [{ role: 'system', content: systemMessage }, { role: 'user', content: userMessage }];
}

/**
 * Fix common LLM output issues that break Obsidian rendering:
 * - Callout lines (> [!hint], > [!check]) indented inside numbered lists
 * - "&" in Mermaid node labels renders as "&amp;" in Obsidian's Mermaid renderer
 */
export function postProcessLLMOutput(text: string): string {
    // Strip leading whitespace from callout lines so they render at column 1
    let result = text.replace(/^[ \t]+(>[^\n]*)/gm, '$1');

    // Replace "&" with "and" inside mermaid blocks (Obsidian renders & as &amp;)
    result = result.replace(/```mermaid\n([\s\S]*?)```/g, (_match, body: string) => {
        return '```mermaid\n' + body.replace(/&/g, 'and') + '```';
    });

    return result;
}

export class LLMError extends Error {
    constructor(public status: number, public apiError: unknown) {
        super(`LLM API error: status ${status}`);
    }
}

export function classifyError(status: number, apiError?: unknown, provider = 'OpenAI'): string {
    if (status === 401) return `${provider} API key invalid. Check your key in Settings.`;
    if (status === 429) return 'Rate limit reached. Wait a moment, then try again.';
    if (status === 400) {
        const code = (apiError as { error?: { code?: string } })?.error?.code;
        if (code === 'context_length_exceeded') {
            return 'Folder is too large to process. Try removing some notes or reducing note length.';
        }
        const message = (apiError as { error?: { message?: string } })?.error?.message;
        if (message && /credit balance|billing|payment/i.test(message)) {
            return `${provider} account has no credits. Add billing at your provider's dashboard.`;
        }
    }
    if (status === 403) return `${provider} API key lacks permission. Check your API key and account status.`;
    if (status >= 500) return `${provider} service error. Please try again later.`;
    return `${provider} API error (${status}). Check the console for details.`;
}

async function callOpenAI(
    apiKey: string,
    model: string,
    messages: Array<{ role: 'system' | 'user'; content: string }>
): Promise<string> {
    const response = await requestUrl({
        url: 'https://api.openai.com/v1/chat/completions',
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model, messages }),
        throw: false,
    });

    if (response.status !== 200) {
        throw new LLMError(response.status, response.json);
    }

    const content = response.json?.choices?.[0]?.message?.content;

    if (response.json?.choices?.[0]?.finish_reason === 'length') {
        new Notice('Warning: response may be truncated due to token limit.');
    }

    if (!content) {
        throw new Error('Empty response from LLM');
    }

    return content;
}

async function callGemini(
    apiKey: string,
    model: string,
    messages: Array<{ role: 'system' | 'user'; content: string }>
): Promise<string> {
    const systemMsg = messages.find(m => m.role === 'system');
    const userMessages = messages.filter(m => m.role !== 'system');

    const body: Record<string, unknown> = {
        contents: userMessages.map(m => ({
            role: 'user',
            parts: [{ text: m.content }],
        })),
        generationConfig: { maxOutputTokens: 8192 },
    };
    if (systemMsg) {
        body.system_instruction = { parts: [{ text: systemMsg.content }] };
    }

    const response = await requestUrl({
        url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        throw: false,
    });

    if (response.status !== 200) {
        throw new LLMError(response.status, response.json);
    }

    const candidate = response.json?.candidates?.[0];
    if (!candidate) {
        new Notice('Gemini blocked this content due to safety filters.');
        throw new Error('Gemini safety block');
    }

    const content = candidate?.content?.parts?.[0]?.text;
    if (candidate?.finishReason === 'MAX_TOKENS') {
        new Notice('Warning: response may be truncated due to token limit.');
    }
    if (!content) {
        throw new Error('Empty response from LLM');
    }
    return content;
}

async function callAnthropic(
    apiKey: string,
    model: string,
    messages: Array<{ role: 'system' | 'user'; content: string }>
): Promise<string> {
    const systemMsg = messages.find(m => m.role === 'system');
    const userMessages = messages.filter(m => m.role !== 'system');

    const body: Record<string, unknown> = {
        model,
        max_tokens: 8192,
        messages: userMessages.map(m => ({ role: m.role, content: m.content })),
    };
    if (systemMsg) {
        body.system = systemMsg.content;
    }

    const response = await requestUrl({
        url: 'https://api.anthropic.com/v1/messages',
        method: 'POST',
        headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        throw: false,
    });

    if (response.status !== 200) {
        throw new LLMError(response.status, response.json);
    }

    const content = response.json?.content?.[0]?.text;
    if (response.json?.stop_reason === 'max_tokens') {
        new Notice('Warning: response may be truncated due to token limit.');
    }
    if (!content) {
        throw new Error('Empty response from LLM');
    }
    return content;
}

export async function callLLM(
    provider: LLMProvider,
    apiKey: string,
    model: string,
    messages: Array<{ role: 'system' | 'user'; content: string }>
): Promise<string> {
    switch (provider) {
        case 'gemini': return callGemini(apiKey, model, messages);
        case 'anthropic': return callAnthropic(apiKey, model, messages);
        case 'openai':
        default:
            return callOpenAI(apiKey, model, messages);
    }
}

export async function writeOutput(app: App, folderPath: string, content: string): Promise<void> {
    const filePath = `${folderPath}/_self-test.md`;
    const existing = app.vault.getAbstractFileByPath(filePath);
    if (existing instanceof TFile) {
        await app.vault.modify(existing, content);
    } else {
        await app.vault.create(filePath, content);
    }
}

export class GenerationService {
    constructor(
        private app: App,
        private settings: ActiveRecallSettings,
        private statusBarItem: { setText(text: string): void }
    ) {}

    async generate(spec: CollectionSpec): Promise<void> {
        const providerCfg = this.settings[this.settings.provider];
        this.statusBarItem.setText('Generating self-test...');
        try {
            let files: TFile[];
            let outputPath: string;
            let displayName: string;

            switch (spec.mode) {
                case 'folder':
                    files = collectNoteFiles(this.app, spec.folderPath);
                    outputPath = `${spec.folderPath}/_self-test.md`;
                    displayName = spec.folderPath.split('/').pop() ?? spec.folderPath;
                    break;
                case 'tag':
                    files = collectNotesByTag(this.app, spec.tag);
                    outputPath = buildTagOutputPath(spec.tag);
                    displayName = `tag #${spec.tag.replace(/^#/, '')}`;
                    break;
                case 'links':
                    files = collectNotesByLinks(this.app, spec.rootFile, spec.depth);
                    outputPath = buildLinksOutputPath(spec.rootFile);
                    displayName = `links from ${spec.rootFile.basename}`;
                    break;
                case 'note':
                    files = [spec.file];
                    outputPath = buildNoteOutputPath(spec.file, this.settings.singleNoteOutputMode);
                    displayName = spec.file.basename;
                    break;
            }

            if (files.length === 0) {
                new Notice('No notes found for this selection.');
                return;
            }

            const notes = await readNotes(this.app, files);
            const batches = splitIntoBatches(notes);

            let finalContent: string;

            if (batches.length === 1) {
                const userMessage = buildBatchPrompt(batches[0]!, this.settings);
                const messages = buildMessages(SYSTEM_MESSAGE, userMessage);
                finalContent = await callLLM(this.settings.provider, providerCfg.apiKey, providerCfg.model, messages);
            } else {
                const partialOutputs: string[] = [];
                for (let i = 0; i < batches.length; i++) {
                    this.statusBarItem.setText(`Generating self-test... (batch ${i + 1}/${batches.length})`);
                    const userMessage = buildBatchPrompt(batches[i]!, this.settings);
                    const messages = buildMessages(SYSTEM_MESSAGE, userMessage);
                    const partial = await callLLM(this.settings.provider, providerCfg.apiKey, providerCfg.model, messages);
                    partialOutputs.push(partial);
                }
                const synthesisMessage = buildSynthesisPrompt(partialOutputs, this.settings);
                const synthesisMessages = buildMessages(SYSTEM_MESSAGE, synthesisMessage);
                finalContent = await callLLM(this.settings.provider, providerCfg.apiKey, providerCfg.model, synthesisMessages);
            }

            finalContent = postProcessLLMOutput(finalContent);

            // Build mode-aware frontmatter (D-14)
            const frontmatter = buildFrontmatter(spec, files);
            const title = `# Self-Test: ${displayName}`;
            const output = frontmatter + title + '\n\n' + finalContent;

            if (spec.mode === 'folder') {
                await writeOutput(this.app, spec.folderPath, output);
            } else {
                await writeOutputToPath(this.app, outputPath, output);
            }
            new Notice(`Self-test written for ${displayName}`);
        } catch (err) {
            console.error('[self-test] Generation error:', err);
            if (err instanceof LLMError) {
                console.error('[self-test] LLMError status:', err.status, 'body:', JSON.stringify(err.apiError));
            }
            const providerLabel = PROVIDER_CONFIG[this.settings.provider].label;
            const msg = err instanceof LLMError
                ? classifyError(err.status, err.apiError, providerLabel)
                : 'Generation failed. Check your settings and try again.';
            new Notice(msg);
        } finally {
            this.statusBarItem.setText('');
        }
    }
}

import { App, TFile, TFolder, Notice, requestUrl } from 'obsidian';
import { ActiveRecallSettings } from './settings';

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
            child.basename !== '_self-test'
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

function buildFormattingInstructions(settings: ActiveRecallSettings): {
    hintInstruction: string;
    checkInstruction: string;
    languageInstruction: string;
    customInstruction: string;
} {
    return {
        hintInstruction: settings.generateHints
            ? `- After each question, add a collapsible hint using this exact callout syntax:\n  > [!hint]-\n  > Your hint text here`
            : '',
        checkInstruction: settings.generateReferenceAnswers
            ? `- After each hint (or question if hints are disabled), add a collapsible reference answer:\n  > [!check]-\n  > Your reference answer here`
            : '',
        languageInstruction: settings.language
            ? `\nWrite all output in ${settings.language}.`
            : '',
        customInstruction: settings.customInstructions
            ? `\n${settings.customInstructions}`
            : '',
    };
}

export function buildBatchPrompt(notes: NoteSource[], settings: ActiveRecallSettings): string {
    const noteBlocks = notes
        .map((n) => `=== Note: ${n.name} ===\n${n.content}`)
        .join('\n\n');

    const { hintInstruction, checkInstruction, languageInstruction, customInstruction } =
        buildFormattingInstructions(settings);

    const conceptMapInstruction = settings.generateConceptMap
        ? `## Concept Map
Output a concept map as a 2-level bullet hierarchy showing the main concepts and their key relationships.
Format:
- Main concept
  - Related sub-concept or relationship
(Max 2 levels. Then add a horizontal rule: ---)

`
        : '';

    return `${noteBlocks}

---

You are creating an active recall self-test from the notes above. Follow these instructions exactly:

${conceptMapInstruction}Generate questions organized into categories. Order all questions from foundational to advanced.

Use these category headings (H2 markdown):
## Conceptual
## Relationships
## Application

Omit any category heading when the content is too simple or too narrow to warrant it.

Number questions within each category (1. 2. 3.).
${hintInstruction}
${checkInstruction}

Output raw markdown only. Do not wrap output in code fences.${languageInstruction}${customInstruction}`;
}

export function buildSynthesisPrompt(partialOutputs: string[], settings: ActiveRecallSettings): string {
    const combined = partialOutputs
        .map((output, i) => `=== Partial Output ${i + 1} ===\n${output}`)
        .join('\n\n');

    const { hintInstruction, checkInstruction, languageInstruction, customInstruction } =
        buildFormattingInstructions(settings);

    const conceptMapInstruction = settings.generateConceptMap
        ? `Include a ## Concept Map section at the top as a 2-level bullet hierarchy, followed by a horizontal rule (---).

`
        : '';

    return `${combined}

---

You are receiving multiple partial question sets from a large folder of notes. Synthesize them into a single, unified self-test by:
1. Deduplicating overlapping or redundant questions
2. Reordering all questions from foundational to advanced
3. Improving overall coherence and flow
4. Organizing into category headings (omit any category when content is too simple or narrow):

${conceptMapInstruction}## Conceptual
## Relationships
## Application

Number questions within each category (1. 2. 3.).
${hintInstruction}
${checkInstruction}

Output raw markdown only. Do not wrap output in code fences.${languageInstruction}${customInstruction}`;
}

export function buildMessages(
    systemMessage: string,
    userMessage: string
): Array<{ role: 'system' | 'user'; content: string }> {
    return [{ role: 'system', content: systemMessage }, { role: 'user', content: userMessage }];
}

export class LLMError extends Error {
    constructor(public status: number, public apiError: unknown) {
        super(`LLM API error: status ${status}`);
    }
}

export function classifyError(status: number): string {
    if (status === 401) return 'Invalid API key. Check your key in Settings.';
    if (status === 429) return 'Rate limit reached. Please wait a moment and try again.';
    if (status >= 500) return 'OpenAI service error. Please try again later.';
    return 'Network error. Check your internet connection.';
}

export async function callLLM(
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

    async generate(folderPath: string): Promise<void> {
        this.statusBarItem.setText('Generating self-test...');
        try {
            const files = collectNoteFiles(this.app, folderPath);
            if (files.length === 0) {
                new Notice('No notes found in this folder.');
                return;
            }

            const notes = await readNotes(this.app, files);
            const batches = splitIntoBatches(notes);
            const folderName = folderPath.split('/').pop() ?? folderPath;

            const SYSTEM_MESSAGE = 'You are an expert educator creating active recall study materials.';

            let finalContent: string;

            if (batches.length === 1) {
                // CTX-02: single call
                const userMessage = buildBatchPrompt(batches[0]!, this.settings);
                const messages = buildMessages(SYSTEM_MESSAGE, userMessage);
                finalContent = await callLLM(this.settings.apiKey, this.settings.model, messages);
            } else {
                // CTX-03: batch + synthesize
                const partialOutputs: string[] = [];
                for (let i = 0; i < batches.length; i++) {
                    this.statusBarItem.setText(`Generating self-test... (batch ${i + 1}/${batches.length})`);
                    const userMessage = buildBatchPrompt(batches[i]!, this.settings);
                    const messages = buildMessages(SYSTEM_MESSAGE, userMessage);
                    const partial = await callLLM(this.settings.apiKey, this.settings.model, messages);
                    partialOutputs.push(partial);
                }
                const synthesisMessage = buildSynthesisPrompt(partialOutputs, this.settings);
                const synthesisMessages = buildMessages(SYSTEM_MESSAGE, synthesisMessage);
                finalContent = await callLLM(this.settings.apiKey, this.settings.model, synthesisMessages);
            }

            // Prepend YAML frontmatter
            const frontmatter = `---\nlast_review: null\nnext_review: null\nreview_count: 0\nreview_interval_days: 1\n---\n\n# Self-Test: ${folderName}\n\n`;
            const output = frontmatter + finalContent;

            await writeOutput(this.app, folderPath, output);
            new Notice(`Self-test written to ${folderName}/`);
        } catch (err) {
            const msg = err instanceof LLMError
                ? classifyError(err.status)
                : 'Generation failed. Check your settings and try again.';
            new Notice(msg);
        } finally {
            this.statusBarItem.setText('');
        }
    }
}

import {
  GenerationService,
  collectNoteFiles,
  buildBatchPrompt,
  writeOutput,
  estimateTokens,
  INPUT_BUDGET_CHARS,
  classifyError,
  callLLM,
  LLMError,
  postProcessLLMOutput,
} from '../generation';
import {
  TFile,
  TFolder,
  Notice,
  requestUrl,
  createMockApp,
  createMockStatusBarItem,
} from '../__mocks__/obsidian';
import type { ActiveRecallSettings } from '../settings';

const defaultSettings: ActiveRecallSettings = {
  provider: 'openai',
  openai: { apiKey: 'sk-test', model: 'gpt-4o-mini' },
  gemini: { apiKey: '', model: 'gemini-2.5-flash' },
  anthropic: { apiKey: '', model: 'claude-sonnet-4-6' },
  language: '',
  generateHints: true,
  generateReferenceAnswers: true,
  generateConceptMap: true,
  customInstructions: '',
  singleNoteOutputMode: 'same-folder',
};

beforeEach(() => {
  jest.clearAllMocks();
  (requestUrl as jest.Mock).mockResolvedValue({
    status: 200,
    json: {
      choices: [
        {
          message: { content: 'Generated content' },
          finish_reason: 'stop',
        },
      ],
    },
  });
});

describe('GenerationService', () => {

  describe('GEN-01: Note collection', () => {
    test('collects top-level .md files from a folder, excludes _self-test.md, excludes subfolders', () => {
      const app = createMockApp();
      const note1 = new TFile('folder/note1.md');
      const note2 = new TFile('folder/note2.md');
      const selfTest = new TFile('folder/_self-test.md');
      const subfolder = new TFolder('folder/subfolder');
      const folder = new TFolder('folder', [note1, note2, selfTest, subfolder]);

      (app.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(folder);

      const result = collectNoteFiles(app as any, 'folder');
      expect(result).toHaveLength(2);
      expect(result).toContain(note1);
      expect(result).toContain(note2);
    });

    test('returns empty array for non-existent path', () => {
      const app = createMockApp();
      (app.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(null);

      const result = collectNoteFiles(app as any, 'nonexistent');
      expect(result).toHaveLength(0);
    });
  });

  describe('GEN-02 / GEN-03: Prompt structure', () => {
    test('prompt instructs LLM to order questions general and simple to complex and specific', () => {
      const notes = [{ name: 'note1', content: 'some content' }];
      const prompt = buildBatchPrompt(notes, defaultSettings);
      expect(prompt).toContain('general and simple to complex and specific');
    });

    test('prompt instructs LLM to omit category headings when content is too simple or narrow', () => {
      const notes = [{ name: 'note1', content: 'some content' }];
      const prompt = buildBatchPrompt(notes, defaultSettings);
      expect(prompt).toContain('## Conceptual');
      expect(prompt.toLowerCase()).toContain('omit');
    });
  });

  describe('GEN-04 / GEN-05: Callout syntax in prompt', () => {
    test('prompt includes > [!hint]- syntax instruction when generateHints is true', () => {
      const notes = [{ name: 'note1', content: 'some content' }];
      const prompt = buildBatchPrompt(notes, { ...defaultSettings, generateHints: true });
      expect(prompt).toContain('> [!hint]-');
    });

    test('prompt includes > [!check]- syntax instruction when generateReferenceAnswers is true', () => {
      const notes = [{ name: 'note1', content: 'some content' }];
      const prompt = buildBatchPrompt(notes, { ...defaultSettings, generateReferenceAnswers: true });
      expect(prompt).toContain('> [!check]-');
    });

    test('prompt does NOT include > [!hint]- when generateHints is false', () => {
      const notes = [{ name: 'note1', content: 'some content' }];
      const prompt = buildBatchPrompt(notes, { ...defaultSettings, generateHints: false });
      expect(prompt).not.toContain('> [!hint]-');
    });

    test('prompt does NOT include > [!check]- when generateReferenceAnswers is false', () => {
      const notes = [{ name: 'note1', content: 'some content' }];
      const prompt = buildBatchPrompt(notes, { ...defaultSettings, generateReferenceAnswers: false });
      expect(prompt).not.toContain('> [!check]-');
    });
  });

  describe('GEN-06: Concept map', () => {
    test('prompt includes concept map instruction when generateConceptMap is true', () => {
      const notes = [{ name: 'note1', content: 'some content' }];
      const prompt = buildBatchPrompt(notes, { ...defaultSettings, generateConceptMap: true });
      expect(prompt.toLowerCase()).toContain('concept map');
    });

    test('prompt omits concept map instruction when generateConceptMap is false', () => {
      const notes = [{ name: 'note1', content: 'some content' }];
      const prompt = buildBatchPrompt(notes, { ...defaultSettings, generateConceptMap: false });
      expect(prompt.toLowerCase()).not.toContain('concept map');
    });
  });

  describe('GEN-07: File write', () => {
    test('calls vault.create() when _self-test.md does not exist', async () => {
      const app = createMockApp();
      (app.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(null);

      await writeOutput(app as any, '/folder', 'content');

      expect(app.vault.create).toHaveBeenCalledWith('/folder/_self-test.md', 'content');
      expect(app.vault.modify).not.toHaveBeenCalled();
    });

    test('calls vault.modify() when _self-test.md already exists', async () => {
      const app = createMockApp();
      const existingFile = new TFile('/folder/_self-test.md');
      (app.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(existingFile);

      await writeOutput(app as any, '/folder', 'content');

      expect(app.vault.modify).toHaveBeenCalledWith(existingFile, 'content');
      expect(app.vault.create).not.toHaveBeenCalled();
    });
  });

  describe('CTX-01 / CTX-02 / CTX-03: Token budget', () => {
    test('estimateTokens returns Math.ceil(chars / 4)', () => {
      expect(estimateTokens('hello world')).toBe(Math.ceil(11 / 4));
      expect(estimateTokens('')).toBe(0);
    });

    test('makes a single API call when total note content fits within the token budget', async () => {
      const app = createMockApp();
      const note1 = new TFile('folder/note1.md');
      const folder = new TFolder('folder', [note1]);
      (app.vault.getAbstractFileByPath as jest.Mock)
        .mockReturnValueOnce(folder)
        .mockReturnValue(null);
      (app.vault.read as jest.Mock).mockResolvedValue('short content');

      const statusBar = createMockStatusBarItem();
      const service = new GenerationService(app as any, defaultSettings, statusBar);
      await service.generate({ mode: 'folder', folderPath: 'folder' });

      expect(requestUrl).toHaveBeenCalledTimes(1);
    });

    test('makes multiple batch calls plus a synthesis call when content exceeds the token budget', async () => {
      const app = createMockApp();
      const note1 = new TFile('folder/note1.md');
      const note2 = new TFile('folder/note2.md');
      const folder = new TFolder('folder', [note1, note2]);
      (app.vault.getAbstractFileByPath as jest.Mock)
        .mockReturnValueOnce(folder)
        .mockReturnValue(null);

      // Each note individually exceeds the budget, forcing 2 batches
      const largeContent = 'x'.repeat(INPUT_BUDGET_CHARS + 1);
      (app.vault.read as jest.Mock).mockResolvedValue(largeContent);

      const statusBar = createMockStatusBarItem();
      const service = new GenerationService(app as any, defaultSettings, statusBar);
      await service.generate({ mode: 'folder', folderPath: 'folder' });

      // 2 batch calls + 1 synthesis call = 3 total
      expect(requestUrl).toHaveBeenCalledTimes(3);
    });
  });

  describe('FB-01 / FB-02: Feedback', () => {
    test('status bar setText is called with progress string and cleared in finally block', async () => {
      const app = createMockApp();
      const note1 = new TFile('folder/note1.md');
      const folder = new TFolder('folder', [note1]);
      (app.vault.getAbstractFileByPath as jest.Mock)
        .mockReturnValueOnce(folder)
        .mockReturnValue(null);
      (app.vault.read as jest.Mock).mockResolvedValue('content');

      // Make requestUrl throw to trigger error path and verify finally still clears
      (requestUrl as jest.Mock).mockRejectedValueOnce(new Error('Network failure'));

      const statusBar = createMockStatusBarItem();
      const service = new GenerationService(app as any, defaultSettings, statusBar);
      await service.generate({ mode: 'folder', folderPath: 'folder' });

      expect(statusBar.setText).toHaveBeenCalledWith(expect.stringContaining('Generating'));
      expect(statusBar.setText).toHaveBeenLastCalledWith('');
    });

    test('maps status 401 to plain-language error; does not expose raw API error string', () => {
      // Test classifyError directly - this is the authoritative error mapping function
      const userFacingMsg = classifyError(401);
      expect(userFacingMsg).toBe('OpenAI API key invalid. Check your key in Settings.');
      expect(userFacingMsg).not.toContain('sk-');

      // 429 must use exact wording without "Please"
      expect(classifyError(429)).toBe('Rate limit reached. Wait a moment, then try again.');
    });

    test('maps status 400 with context_length_exceeded to folder-too-large message', () => {
      const apiError = { error: { code: 'context_length_exceeded' } };
      expect(classifyError(400, apiError)).toBe('Folder is too large to process. Try removing some notes or reducing note length.');
    });

    test('maps status 400 without context_length_exceeded to generic API error fallback', () => {
      expect(classifyError(400)).toBe('OpenAI API error (400). Check the console for details.');
    });

    test('maps status 400 with credit balance message to billing error', () => {
      const apiError = { error: { message: 'Your credit balance is too low to access the Anthropic API.' } };
      expect(classifyError(400, apiError, 'Claude (Anthropic)')).toBe('Claude (Anthropic) account has no credits. Add billing at your provider\'s dashboard.');
    });

    test('maps status 403 to permission error with provider name', () => {
      expect(classifyError(403, undefined, 'Gemini')).toBe('Gemini API key lacks permission. Check your API key and account status.');
    });

    test('maps status 500 to service error message', () => {
      expect(classifyError(500)).toBe('OpenAI service error. Please try again later.');
    });
  });

});

// Helper messages for assertions
const messages = [
  { role: 'system' as const, content: 'You are a helpful assistant.' },
  { role: 'user' as const, content: 'Generate questions about photosynthesis.' },
];

describe('PROV-06: classifyError with provider', () => {
  test('classifyError(401, undefined, "Gemini") returns Gemini-branded message', () => {
    expect(classifyError(401, undefined, 'Gemini')).toBe('Gemini API key invalid. Check your key in Settings.');
  });

  test('classifyError(500, undefined, "Claude (Anthropic)") returns Anthropic-branded message', () => {
    expect(classifyError(500, undefined, 'Claude (Anthropic)')).toBe('Claude (Anthropic) service error. Please try again later.');
  });

  test('classifyError(429, undefined, "Gemini") returns rate limit message without provider name', () => {
    expect(classifyError(429, undefined, 'Gemini')).toBe('Rate limit reached. Wait a moment, then try again.');
  });

  test('classifyError(400, contextLengthError, "Gemini") returns folder-too-large message', () => {
    const apiError = { error: { code: 'context_length_exceeded' } };
    expect(classifyError(400, apiError, 'Gemini')).toBe('Folder is too large to process. Try removing some notes or reducing note length.');
  });

  test('classifyError(401) with no provider returns OpenAI default message', () => {
    expect(classifyError(401)).toBe('OpenAI API key invalid. Check your key in Settings.');
  });
});

describe('PROV-04: Gemini adapter', () => {
  test('happy path: returns text from candidates[0].content.parts[0].text', async () => {
    (requestUrl as jest.Mock).mockResolvedValueOnce({
      status: 200,
      json: {
        candidates: [{
          content: { parts: [{ text: 'Gemini output' }] },
          finishReason: 'STOP',
        }],
      },
    });

    const result = await callLLM('gemini', 'AIza-test', 'gemini-2.5-flash', messages);
    expect(result).toBe('Gemini output');

    const call = (requestUrl as jest.Mock).mock.calls[0][0] as { url: string; body: string; headers: Record<string, string> };
    expect(call.url).toContain('generativelanguage.googleapis.com');
    expect(call.url).toContain('key=AIza-test');

    const body = JSON.parse(call.body) as {
      system_instruction: { parts: [{ text: string }] };
      contents: Array<{ role: string; parts: [{ text: string }] }>;
      generationConfig: { maxOutputTokens: number };
    };
    expect(body.system_instruction.parts[0].text).toBe('You are a helpful assistant.');
    expect(body.contents[0]!.role).toBe('user');
    expect(body.generationConfig.maxOutputTokens).toBe(8192);
  });

  test('safety block: throws when candidates array is empty and shows Notice', async () => {
    (requestUrl as jest.Mock).mockResolvedValueOnce({
      status: 200,
      json: { candidates: [] },
    });

    await expect(callLLM('gemini', 'AIza-test', 'gemini-2.5-flash', messages))
      .rejects.toThrow('safety block');

    const noticeCalls = (Notice as jest.Mock).mock.calls.map((c: [string]) => c[0]);
    expect(noticeCalls.some((msg: string) => msg.includes('safety filters'))).toBe(true);
  });

  test('truncation with content: returns partial text and shows truncation Notice', async () => {
    (requestUrl as jest.Mock).mockResolvedValueOnce({
      status: 200,
      json: {
        candidates: [{
          content: { parts: [{ text: 'partial' }] },
          finishReason: 'MAX_TOKENS',
        }],
      },
    });

    const result = await callLLM('gemini', 'AIza-test', 'gemini-2.5-flash', messages);
    expect(result).toBe('partial');

    const noticeCalls = (Notice as jest.Mock).mock.calls.map((c: [string]) => c[0]);
    expect(noticeCalls).toContain('Warning: response may be truncated due to token limit.');
  });

  test('truncation without content (Gemini 2.5 bug): throws Empty response from LLM', async () => {
    (requestUrl as jest.Mock).mockResolvedValueOnce({
      status: 200,
      json: {
        candidates: [{
          content: { parts: [{ text: '' }] },
          finishReason: 'MAX_TOKENS',
        }],
      },
    });

    await expect(callLLM('gemini', 'AIza-test', 'gemini-2.5-flash', messages))
      .rejects.toThrow('Empty response from LLM');
  });

  test('API error: throws LLMError with correct status on non-200 response', async () => {
    (requestUrl as jest.Mock).mockResolvedValueOnce({
      status: 401,
      json: { error: { message: 'bad key' } },
    });

    await expect(callLLM('gemini', 'AIza-test', 'gemini-2.5-flash', messages))
      .rejects.toBeInstanceOf(LLMError);

    try {
      await callLLM('gemini', 'AIza-test', 'gemini-2.5-flash', messages);
    } catch (e) {
      // second call needs a mock too
    }
  });
});

describe('PROV-05: Anthropic adapter', () => {
  test('happy path: returns text from content[0].text with correct headers and body', async () => {
    (requestUrl as jest.Mock).mockResolvedValueOnce({
      status: 200,
      json: {
        content: [{ text: 'Claude output' }],
        stop_reason: 'end_turn',
      },
    });

    const result = await callLLM('anthropic', 'sk-ant-test', 'claude-sonnet-4-6', messages);
    expect(result).toBe('Claude output');

    const call = (requestUrl as jest.Mock).mock.calls[0][0] as {
      url: string;
      headers: Record<string, string>;
      body: string;
    };
    expect(call.url).toBe('https://api.anthropic.com/v1/messages');
    expect(call.headers['x-api-key']).toBe('sk-ant-test');
    expect(call.headers['anthropic-version']).toBe('2023-06-01');

    const body = JSON.parse(call.body) as {
      system: string;
      max_tokens: number;
      model: string;
      messages: Array<{ role: string }>;
    };
    expect(body.system).toBe('You are a helpful assistant.');
    expect(body.max_tokens).toBe(8192);
    expect(body.model).toBe('claude-sonnet-4-6');
    expect(body.messages.every((m: { role: string }) => m.role !== 'system')).toBe(true);
  });

  test('truncation: returns partial and shows truncation Notice on stop_reason max_tokens', async () => {
    (requestUrl as jest.Mock).mockResolvedValueOnce({
      status: 200,
      json: {
        content: [{ text: 'partial' }],
        stop_reason: 'max_tokens',
      },
    });

    const result = await callLLM('anthropic', 'sk-ant-test', 'claude-sonnet-4-6', messages);
    expect(result).toBe('partial');

    const noticeCalls = (Notice as jest.Mock).mock.calls.map((c: [string]) => c[0]);
    expect(noticeCalls).toContain('Warning: response may be truncated due to token limit.');
  });

  test('API error: throws LLMError on non-200 response', async () => {
    (requestUrl as jest.Mock).mockResolvedValueOnce({
      status: 401,
      json: { error: { message: 'invalid key' } },
    });

    await expect(callLLM('anthropic', 'sk-ant-test', 'claude-sonnet-4-6', messages))
      .rejects.toBeInstanceOf(LLMError);
  });
});

describe('Provider dispatch', () => {
  test('callLLM("openai", ...) calls api.openai.com', async () => {
    (requestUrl as jest.Mock).mockResolvedValueOnce({
      status: 200,
      json: {
        choices: [{ message: { content: 'OpenAI output' }, finish_reason: 'stop' }],
      },
    });

    await callLLM('openai', 'sk-test', 'gpt-4o-mini', messages);

    const call = (requestUrl as jest.Mock).mock.calls[0][0] as { url: string };
    expect(call.url).toContain('api.openai.com');
  });
});

describe('GenerationService provider error label', () => {
  test('shows provider label in error Notice when Gemini API key is invalid', async () => {
    const app = createMockApp();
    const note1 = new TFile('folder/note1.md');
    const folder = new TFolder('folder', [note1]);
    (app.vault.getAbstractFileByPath as jest.Mock)
      .mockReturnValueOnce(folder)
      .mockReturnValue(null);
    (app.vault.read as jest.Mock).mockResolvedValue('content');
    (requestUrl as jest.Mock).mockResolvedValueOnce({ status: 401, json: {} });

    const geminiSettings: ActiveRecallSettings = {
      provider: 'gemini',
      openai: { apiKey: '', model: 'gpt-4o-mini' },
      gemini: { apiKey: 'AIza-test', model: 'gemini-2.5-flash' },
      anthropic: { apiKey: '', model: 'claude-sonnet-4-6' },
      language: '',
      generateHints: true,
      generateReferenceAnswers: true,
      generateConceptMap: true,
      customInstructions: '',
      singleNoteOutputMode: 'same-folder',
    };

    const statusBar = createMockStatusBarItem();
    const service = new GenerationService(app as never, geminiSettings, statusBar);
    await service.generate({ mode: 'folder', folderPath: 'folder' });

    const noticeCalls = (Notice as jest.Mock).mock.calls.map((c: [string]) => c[0]);
    expect(noticeCalls.some((msg: string) => msg.includes('Gemini'))).toBe(true);
  });
});

describe('postProcessLLMOutput', () => {
  test('strips leading whitespace from callout lines', () => {
    const input = `1. What is X?

    > [!hint]-
    > Think about Y.

    > [!check]-
    > The answer is Z.`;

    const result = postProcessLLMOutput(input);
    expect(result).toBe(`1. What is X?

> [!hint]-
> Think about Y.

> [!check]-
> The answer is Z.`);
  });

  test('preserves callout lines already at column 1', () => {
    const input = `1. What is X?

> [!hint]-
> Already correct.`;

    expect(postProcessLLMOutput(input)).toBe(input);
  });

  test('handles tabs as indentation', () => {
    const input = `\t> [!hint]-\n\t> Tabbed hint.`;
    const result = postProcessLLMOutput(input);
    expect(result).toBe(`> [!hint]-\n> Tabbed hint.`);
  });

  test('replaces & with "and" inside mermaid blocks', () => {
    const input = `\`\`\`mermaid
mindmap
  root((Topic))
    Limitations & Control
    Input & Output
\`\`\``;

    const result = postProcessLLMOutput(input);
    expect(result).toContain('Limitations and Control');
    expect(result).toContain('Input and Output');
    expect(result).not.toContain(' & ');
  });

  test('does not replace & outside mermaid blocks', () => {
    const input = `Use R&D for research & development.`;
    expect(postProcessLLMOutput(input)).toBe(input);
  });
});

import {
  GenerationService,
  collectNoteFiles,
  buildBatchPrompt,
  writeOutput,
  estimateTokens,
  INPUT_BUDGET_CHARS,
  classifyError,
} from '../generation';
import {
  TFile,
  TFolder,
  requestUrl,
  createMockApp,
  createMockStatusBarItem,
} from '../__mocks__/obsidian';
import type { ActiveRecallSettings } from '../settings';

const defaultSettings: ActiveRecallSettings = {
  provider: 'openai',
  apiKey: 'sk-test',
  model: 'gpt-4o-mini',
  language: '',
  generateHints: true,
  generateReferenceAnswers: true,
  generateConceptMap: true,
  customInstructions: '',
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
      await service.generate('folder');

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
      await service.generate('folder');

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
      await service.generate('folder');

      expect(statusBar.setText).toHaveBeenCalledWith(expect.stringContaining('Generating'));
      expect(statusBar.setText).toHaveBeenLastCalledWith('');
    });

    test('maps status 401 to plain-language error; does not expose raw API error string', () => {
      // Test classifyError directly - this is the authoritative error mapping function
      const userFacingMsg = classifyError(401);
      expect(userFacingMsg).toBe('Invalid API key. Check your key in Settings.');
      expect(userFacingMsg).not.toContain('sk-');

      // 429 must use exact wording without "Please"
      expect(classifyError(429)).toBe('Rate limit reached. Wait a moment, then try again.');
    });

    test('maps status 400 with context_length_exceeded to folder-too-large message', () => {
      const apiError = { error: { code: 'context_length_exceeded' } };
      expect(classifyError(400, apiError)).toBe('Folder is too large to process. Try removing some notes or reducing note length.');
    });

    test('maps status 400 without context_length_exceeded to network error fallback', () => {
      expect(classifyError(400)).toBe('Network error. Check your internet connection.');
    });

    test('maps status 500 to service error message', () => {
      expect(classifyError(500)).toBe('OpenAI service error. Please try again later.');
    });
  });

});

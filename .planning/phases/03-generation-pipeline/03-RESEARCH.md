# Phase 3: Generation Pipeline - Research

**Researched:** 2026-03-09
**Domain:** Obsidian plugin file I/O, OpenAI Chat Completions API (via requestUrl), prompt engineering, batch/synthesize pipeline
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Concept map format:**
- Bullet hierarchy, 2 levels max (top concept + one sub-level)
- Horizontal rule (`---`) separator after the concept map, before the questions section
- Omit the section entirely when "Generate concept map" toggle is off - no placeholder comment

**Output structure:**
- YAML frontmatter with reserved v2 spaced-repetition fields: `last_review: null`, `next_review: null`, `review_count: 0`, `review_interval_days: 1`
- Document title: `# Self-Test: [Folder Name]`
- `## Concept Map` heading (H2), then bullet hierarchy, then `---`, then question categories
- Category headings are H2: `## Conceptual`, `## Relationships`, `## Application`
- Categories are omitted when content is too simple or narrow (per GEN-03)
- Questions are numbered (1. 2. 3.) within each category
- Hints: `> [!hint]-` collapsible callout below each question
- Reference answers: `> [!check]-` collapsible callout below each hint
- Hint and reference answer sections omit entirely when respective toggles are off

**Progress feedback:**
- Status bar shows "Generating self-test..." while running; cleared on completion or error
- When batching: status bar updates to "Generating self-test... (batch 2/4)" for each batch
- On completion: a Notice popup confirms (e.g., "Self-test written to FolderName/")
- Errors (wrong API key, network failure, rate limit): Notice popup with plain-language message - no raw API error strings shown to users
- Empty folder (no .md files, or only `_self-test.md`): Notice error "No notes found in this folder." Abort without writing or overwriting any file

**Prompt strategy:**
- System message sets educator persona: "You are an expert educator creating active recall study materials."
- User message contains note content + specific formatting instructions
- LLM outputs raw markdown directly - no code block wrapper, plugin writes as-is
- Question count left entirely to the LLM ("as many questions as the content warrants")
- Synthesis pass (for batched folders): LLM rewrites and reorganizes all partial question sets into a unified, coherent self-test - reordering foundational to advanced, deduplicating, improving coherence

### Claude's Discretion
- Exact system message wording and persona phrasing
- Exact formatting instructions in the user message (how to describe callout syntax, category rules, etc.)
- How to split notes into batches (by note count, by char count, or by token estimate)
- Token budget thresholds and reserve amounts
- NoteSource interface shape and GenerationService class structure
- Where the command is registered (Phase 4 wires the entry points; Phase 3 exposes the generation API)

### Deferred Ideas (OUT OF SCOPE)
None - discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| GEN-01 | Collect all top-level `.md` files from a selected folder (non-recursive, excludes `_self-test.md`) | Vault API: `vault.getAbstractFileByPath()` + `TFolder.children` filter |
| GEN-02 | Generate open-ended recall questions ordered foundational to advanced | Prompt engineering section; system+user message patterns |
| GEN-03 | Categorize into Conceptual/Relationships/Application; omit when too simple | Prompt strategy: instruct LLM to omit categories when not warranted |
| GEN-04 | Collapsible hint per question using `> [!hint]-` callout syntax | Output format section; callout syntax reference |
| GEN-05 | Collapsible reference answer using `> [!check]-` callout syntax | Output format section; callout syntax reference |
| GEN-06 | Generate brief text-based concept map before questions when content supports it | Concept map format decisions; conditional prompt inclusion |
| GEN-07 | Write output to `_self-test.md` in selected folder; overwrite existing | Vault API: `vault.create()` / `vault.modify()` pattern |
| CTX-01 | Estimate token count using `chars / 4` before API call | Token estimation section |
| CTX-02 | Single API call when content fits within token budget | Single-call flow documented |
| CTX-03 | Batch + synthesis when content exceeds budget; deduplicate/reorder in synthesis | Batch pipeline architecture section |
| FB-01 | Progress indicator during generation (status bar) | Status bar API pattern; batch progress update pattern |
| FB-02 | Actionable error message on API failure; no raw API error strings | Error classification and user message mapping |
</phase_requirements>

---

## Summary

Phase 3 builds the core value of the plugin: an async TypeScript service that reads `.md` files from a vault folder, constructs an LLM prompt, calls the OpenAI Chat Completions API via Obsidian's `requestUrl()`, and writes a formatted `_self-test.md`. The two main flows are: (1) single-call when total content fits the token budget, and (2) batch+synthesize when it doesn't.

The Obsidian API side is well-understood and stable. `TFolder.children` gives direct access to a folder's immediate children with `instanceof TFile` filtering. `vault.create()` and `vault.modify()` handle write/overwrite cleanly. The OpenAI API side is a straightforward JSON POST to `https://api.openai.com/v1/chat/completions` - `requestUrl` handles it identically to any HTTP call. The only non-trivial complexity is the batch pipeline sequencing and the prompt design to reliably produce the exact Obsidian callout syntax.

The status bar item must be obtained once at plugin load via `this.addStatusBarItem()` and its `.setText()` / `.setText('')` methods used throughout generation. `new Notice(message)` is the standard completion/error notification - it auto-dismisses after ~5 seconds by default.

**Primary recommendation:** Structure as a standalone `GenerationService` class in `src/generation.ts` that accepts the plugin's `App` reference and `ActiveRecallSettings`, exposing a single `async generate(folderPath: string): Promise<void>` method. Phase 4 calls this method; it owns the full pipeline including feedback.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| obsidian | latest (in package.json) | Vault file I/O, Notice, requestUrl, status bar | Only HTTP client available in Obsidian plugins; all Obsidian types |
| TypeScript | ^5.8.3 | Type safety throughout pipeline | Already established in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| No additional libraries needed | - | All required functionality covered by obsidian package + built-in TS | - |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `requestUrl()` from obsidian | `fetch()` / openai npm SDK | LOCKED - requestUrl is the only HTTP client; proven working in Phase 1 |
| `vault.modify()` for existing files | `vault.adapter.write()` | `vault.modify()` is the high-level API that updates Obsidian's file index; adapter.write() bypasses the index and can cause stale state |

**Installation:**
No new packages needed. All dependencies already installed.

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── main.ts              # Plugin entry point - registers command stub (Phase 4 fills in)
├── settings.ts          # ActiveRecallSettings interface (already complete)
├── generation.ts        # GenerationService class - the entire Phase 3 surface
└── types.ts             # NoteSource interface and shared types (optional, can inline)
```

### Pattern 1: NoteSource Interface
**What:** Thin wrapper around vault file data, decoupled from Obsidian TFile internals
**When to use:** Always - lets Phase 4 and future collection modes pass note content cleanly

```typescript
// src/generation.ts
export interface NoteSource {
    name: string;      // basename without extension
    content: string;   // full text content
}
```

### Pattern 2: Vault Folder Read (non-recursive, exclude _self-test.md)
**What:** Read immediate children of a TFolder, filter to TFile instances with .md extension, exclude `_self-test.md`
**When to use:** GEN-01 - first step of the pipeline

```typescript
// Source: obsidianmd/obsidian-api obsidian.d.ts + verified via Obsidian forum patterns
import { TFile, TFolder, App } from 'obsidian';

function collectNotes(app: App, folderPath: string): TFile[] {
    const folder = app.vault.getAbstractFileByPath(folderPath);
    if (!(folder instanceof TFolder)) return [];

    return folder.children
        .filter((child): child is TFile =>
            child instanceof TFile &&
            child.extension === 'md' &&
            child.basename !== '_self-test'
        );
}
```

### Pattern 3: Write / Overwrite _self-test.md
**What:** Use `vault.create()` for new files and `vault.modify()` for existing ones
**When to use:** GEN-07 - final step after successful generation

```typescript
// Source: obsidianmd/obsidian-api obsidian.d.ts
async function writeOutput(app: App, folderPath: string, content: string): Promise<void> {
    const filePath = `${folderPath}/_self-test.md`;
    const existing = app.vault.getAbstractFileByPath(filePath);
    if (existing instanceof TFile) {
        await app.vault.modify(existing, content);
    } else {
        await app.vault.create(filePath, content);
    }
}
```

**Important:** Never use `vault.adapter.write()` for files already tracked by Obsidian - it bypasses the file index and causes Obsidian to show stale data until manual refresh.

### Pattern 4: OpenAI API Call via requestUrl
**What:** POST to OpenAI chat completions with `throw: false` to handle non-2xx as data
**When to use:** Every LLM call in the pipeline

```typescript
// Source: Obsidian plugin API docs + Phase 1 established pattern
import { requestUrl } from 'obsidian';

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
        body: JSON.stringify({
            model,
            messages,
        }),
        throw: false,
    });

    if (response.status !== 200) {
        // response.json contains { error: { message, type, code } }
        throw new LLMError(response.status, response.json?.error);
    }

    // response.json contains { choices: [{ message: { content: string } }] }
    const content = response.json?.choices?.[0]?.message?.content;
    if (!content) throw new Error('Empty response from LLM');
    return content;
}
```

### Pattern 5: Status Bar Progress
**What:** Obtain status bar item once at plugin load; update text during generation
**When to use:** FB-01

```typescript
// In main.ts onload():
this.statusBarItem = this.addStatusBarItem();

// In GenerationService, receive statusBarItem as constructor param or method arg:
statusBarItem.setText('Generating self-test...');
// For batch N of M:
statusBarItem.setText(`Generating self-test... (batch ${n}/${total})`);
// On completion or error:
statusBarItem.setText('');
```

### Pattern 6: Token Estimation and Batching
**What:** Estimate input tokens with `chars / 4`, reserve headroom for prompt template and output
**When to use:** CTX-01, CTX-02, CTX-03

```typescript
// Token estimation
function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
}

// gpt-4o-mini: 128k context, 16k max output
// Reserve: ~2k for prompt template + ~4k for LLM output per batch = ~6k reserved
// Usable input budget per call: ~122k tokens = ~488k chars
const INPUT_BUDGET_CHARS = 488_000;  // conservative; tune as needed

function splitIntoBatches(notes: NoteSource[]): NoteSource[][] {
    const batches: NoteSource[][] = [];
    let current: NoteSource[] = [];
    let currentChars = 0;

    for (const note of notes) {
        if (currentChars + note.content.length > INPUT_BUDGET_CHARS && current.length > 0) {
            batches.push(current);
            current = [];
            currentChars = 0;
        }
        current.push(note);
        currentChars += note.content.length;
    }
    if (current.length > 0) batches.push(current);
    return batches;
}
```

**Note on thresholds:** The `chars / 4` heuristic is rough. English prose averages ~4 chars/token; code and non-Latin scripts differ. A conservative input budget (leaving 20-30k tokens of headroom beyond the prompt template) prevents hard API errors. The exact threshold is Claude's discretion per CONTEXT.md.

### Pattern 7: Output Document Assembly
**What:** Build the `_self-test.md` content string from parts, respecting user toggle settings
**When to use:** Assembling the final string before writing

```
---
last_review: null
next_review: null
review_count: 0
review_interval_days: 1
---

# Self-Test: [Folder Name]

## Concept Map       <- omit entire section when generateConceptMap is false
- Topic A
  - Sub-concept 1
  - Sub-concept 2
- Topic B

---                  <- only present when concept map is present

## Conceptual        <- omit section entirely when LLM judges content too simple

1. Question text

> [!hint]-           <- omit when generateHints is false
> Hint text

> [!check]-          <- omit when generateReferenceAnswers is false
> Reference answer

## Relationships
...

## Application
...
```

### Anti-Patterns to Avoid
- **Using `vault.adapter.write()` for tracked files:** Bypasses Obsidian's file index. Use `vault.modify()` for existing TFiles.
- **Wrapping LLM output in code blocks before writing:** The prompt must instruct the LLM to output raw markdown; the plugin writes as-is.
- **Constructing status bar text and Notice messages from raw API error strings:** Always map errors to plain-language messages.
- **Awaiting all batch calls in parallel with Promise.all():** Risks hitting rate limits. Await batches sequentially.
- **Holding the entire generated content in memory as separate strings then joining at the end:** Acceptable at this scale - folder content is bounded. Not an issue.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP to OpenAI | Custom fetch wrapper | `requestUrl()` from obsidian | Already established, works in Obsidian context, no CORS issues |
| File existence check | Custom filesystem stat | `vault.getAbstractFileByPath()` returning null | Built-in, handles all vault edge cases |
| Toast notifications | Custom DOM notifications | `new Notice(message)` from obsidian | Auto-dismisses, styled to match Obsidian UI |
| Progress UI | Custom modal or DOM injection | Status bar item via `this.addStatusBarItem()` | Minimal, non-blocking, matches Obsidian plugin conventions |
| Token counting | tiktoken or external tokenizer | `chars / 4` heuristic | External tokenizers can't be bundled easily; heuristic is sufficient for batching |

**Key insight:** The Obsidian API provides all the I/O and UI primitives needed. The "hard" part of this phase is the prompt design and the batch orchestration logic - both pure TypeScript, no libraries required.

---

## Common Pitfalls

### Pitfall 1: vault.adapter.write() vs vault.modify()
**What goes wrong:** `adapter.write()` writes bytes to disk but Obsidian's in-memory file tree doesn't learn about the change. The file appears stale or missing in the UI until Obsidian rescans.
**Why it happens:** `adapter` is a low-level filesystem adapter; `vault` methods are the high-level index-aware API.
**How to avoid:** For any file that may already exist in the vault, use `vault.getAbstractFileByPath()` first. If it returns a TFile, use `vault.modify()`. If null, use `vault.create()`.
**Warning signs:** `_self-test.md` disappears from the file explorer after regeneration, or shows old content.

### Pitfall 2: requestUrl throw:false and error handling
**What goes wrong:** Non-2xx response causes an exception if `throw: false` is omitted, crashing `onload()` context.
**Why it happens:** Default Obsidian `requestUrl` behavior throws on non-2xx.
**How to avoid:** Always pass `throw: false`. Check `response.status` explicitly. This is an established project pattern from Phase 1.
**Warning signs:** Unhandled promise rejection in console on API key error.

### Pitfall 3: LLM wraps output in markdown code fences
**What goes wrong:** The LLM outputs `` ```markdown `` ... ` ``` `` around its response, which gets written literally into `_self-test.md`.
**Why it happens:** Models default to wrapping when they think they're outputting "code."
**How to avoid:** Include explicit instruction in the user message: "Output raw markdown only. Do not wrap the output in code fences or any other wrapper."
**Warning signs:** `_self-test.md` starts with ` ```markdown ` instead of `---`.

### Pitfall 4: Synthesis prompt producing structured output when batching
**What goes wrong:** The synthesis pass returns the same partial format as a batch pass, without deduplication or coherent ordering.
**Why it happens:** The synthesis prompt is too similar to the batch prompt.
**How to avoid:** The synthesis prompt must clearly state it is receiving multiple partial question sets and must produce a single unified self-test. It should explicitly list deduplication, reordering foundational-to-advanced, and improving coherence as tasks.
**Warning signs:** Duplicate questions in the final output, or questions that reference "in batch 2..." style artifacts.

### Pitfall 5: Status bar item not cleared on error
**What goes wrong:** "Generating self-test..." stays in the status bar after a generation failure.
**Why it happens:** Error handler doesn't reset the status bar.
**How to avoid:** Use try/finally to guarantee `statusBarItem.setText('')` runs on both success and error paths.
**Warning signs:** Status bar permanently shows generating state after a failed call.

### Pitfall 6: noUncheckedIndexedAccess strict TS flag
**What goes wrong:** `response.json.choices[0].message.content` fails TypeScript compilation without optional chaining.
**Why it happens:** `tsconfig.json` has `noUncheckedIndexedAccess: true` - array indexing returns `T | undefined`.
**How to avoid:** Use optional chaining: `response.json?.choices?.[0]?.message?.content`. Add a runtime null check after.
**Warning signs:** TypeScript compiler errors during `npm run build`.

---

## Code Examples

### Full OpenAI error response shape
```typescript
// Source: OpenAI API reference (verified via search)
// Non-2xx response body:
{
    "error": {
        "message": "Incorrect API key provided...",
        "type": "invalid_request_error",
        "code": "invalid_api_key"
    }
}

// Error classification for user-facing messages:
// status 401 -> "Invalid API key. Check your key in Settings."
// status 429 -> "Rate limit reached. Please wait a moment and try again."
// status 500/503 -> "OpenAI service error. Please try again later."
// status 0 / network -> "Network error. Check your internet connection."
```

### Successful OpenAI response shape
```typescript
// Source: OpenAI API reference
{
    "choices": [{
        "message": {
            "role": "assistant",
            "content": "## Concept Map\n..."
        },
        "finish_reason": "stop"
    }],
    "usage": {
        "prompt_tokens": 1234,
        "completion_tokens": 567,
        "total_tokens": 1801
    }
}
// finish_reason: "length" means max_tokens hit - output may be truncated
```

### Obsidian Callout Syntax (for prompt instructions)
```markdown
> [!hint]-
> The hint text goes here.
> Multiple lines are fine.

> [!check]-
> The reference answer goes here.
```

The `-` after the callout type makes it collapsible and collapsed by default. This must be described precisely in the prompt instructions since the LLM needs to reproduce this syntax accurately.

### YAML Frontmatter for Output File
```typescript
// The exact frontmatter block to prepend to all generated files:
const frontmatter = `---
last_review: null
next_review: null
review_count: 0
review_interval_days: 1
---\n\n`;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `vault.getFileByPath()` not available | `vault.getAbstractFileByPath()` then instanceof check | Obsidian added `getFileByPath()` later | Both work; `getFileByPath()` returns `TFile | null` directly - prefer it for file-specific operations |
| `throw: true` (default) on requestUrl | `throw: false` + manual status check | Phase 1 decision | Non-2xx no longer crashes the plugin |

**Deprecated/outdated:**
- `vault.adapter.write()` for vault files: Works at the FS level but bypasses Obsidian index. Only acceptable for files outside the vault or during initialization. Not recommended for `_self-test.md`.

---

## Open Questions

1. **Exact token budget thresholds**
   - What we know: gpt-4o-mini has 128k context, 16k max output; `chars / 4` is the heuristic
   - What's unclear: Should the input budget be per-batch or checked against total first? What reserve is right for the synthesis prompt?
   - Recommendation: 488k chars (~122k tokens) usable per batch is conservative; start there and note it as a tunable constant

2. **Synthesis pass when there's only one batch**
   - What we know: CTX-02 says single API call when content fits; CTX-03 says batch+synthesize when it doesn't
   - What's unclear: Should the synthesis pass run even with a single batch (for consistency), or only when N > 1 batches?
   - Recommendation: Only run synthesis when N > 1 batches. When N = 1, the batch output IS the final output.

3. **finish_reason: "length" handling**
   - What we know: If the LLM hits max_tokens, it stops mid-output. The output will be truncated.
   - What's unclear: Should the plugin detect this and show a warning? Or silently write the truncated output?
   - Recommendation: Check `finish_reason` on each API call. If "length", show a Notice warning that output may be incomplete, but still write what was generated. Don't abort.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None currently installed |
| Config file | None - Wave 0 must create |
| Quick run command | `npx jest --testPathPattern=src/` |
| Full suite command | `npx jest` |

**Note:** No test framework is installed. The project uses esbuild + TypeScript only. `nyquist_validation` is enabled in config.json. Wave 0 must install Jest with ts-jest and set up mocks for the `obsidian` package (which is external to the bundle and unavailable in Node test context).

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GEN-01 | Collect top-level .md files, exclude _self-test.md, exclude subfolders | unit | `npx jest --testPathPattern=generation` | Wave 0 |
| GEN-02 | Prompt instructs foundational-to-advanced ordering | unit (prompt inspection) | `npx jest --testPathPattern=generation` | Wave 0 |
| GEN-03 | Category omission logic reflected in prompt | unit (prompt inspection) | `npx jest --testPathPattern=generation` | Wave 0 |
| GEN-04 | Hint callout syntax present in prompt instructions | unit (prompt string) | `npx jest --testPathPattern=generation` | Wave 0 |
| GEN-05 | Check callout syntax present in prompt instructions | unit (prompt string) | `npx jest --testPathPattern=generation` | Wave 0 |
| GEN-06 | Concept map conditional: included when toggle on, absent when off | unit | `npx jest --testPathPattern=generation` | Wave 0 |
| GEN-07 | vault.create() called for new file; vault.modify() for existing | unit (mock) | `npx jest --testPathPattern=generation` | Wave 0 |
| CTX-01 | Token estimate returns ceil(chars/4) | unit | `npx jest --testPathPattern=generation` | Wave 0 |
| CTX-02 | Single API call when total chars under budget | unit (mock) | `npx jest --testPathPattern=generation` | Wave 0 |
| CTX-03 | Multiple API calls + synthesis call when over budget | unit (mock) | `npx jest --testPathPattern=generation` | Wave 0 |
| FB-01 | Status bar setText called with progress string; cleared in finally | unit (mock) | `npx jest --testPathPattern=generation` | Wave 0 |
| FB-02 | Error statuses map to plain-language strings; no raw API error exposed | unit | `npx jest --testPathPattern=generation` | Wave 0 |

**Manual-only:** None - all requirements are unit-testable with mocks.

### Sampling Rate
- **Per task commit:** `npx jest --testPathPattern=generation --passWithNoTests`
- **Per wave merge:** `npx jest`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `jest.config.cjs` - Jest config with ts-jest transformer, moduleNameMapper for `obsidian` mock
- [ ] `src/__mocks__/obsidian.ts` - Mock module for `TFile`, `TFolder`, `Notice`, `requestUrl`, status bar item
- [ ] `src/__tests__/generation.test.ts` - Test file covering all requirements above
- [ ] Install: `npm install --save-dev jest ts-jest @types/jest`

---

## Sources

### Primary (HIGH confidence)
- `obsidianmd/obsidian-api` on GitHub (obsidian.d.ts) - Vault.read(), create(), modify(), getAbstractFileByPath(), TFile, TFolder, DataAdapter.list()
- `src/settings.ts` in this project - ActiveRecallSettings interface (direct read)
- `src/main.ts` in this project - established requestUrl pattern, statusBarItem, Notice usage
- Phase 1 and Phase 2 STATE.md decisions - requestUrl locked, throw:false locked

### Secondary (MEDIUM confidence)
- OpenAI community forum + docsbot.ai/models/gpt-4o-mini - gpt-4o-mini: 128k context, 16k max output tokens
- Obsidian forum plugin development threads - vault.modify() vs adapter.write() distinction, instanceof TFile/TFolder type narrowing best practice
- OpenAI API reference search results - response shape: choices[0].message.content, error shape: error.message/type/code

### Tertiary (LOW confidence)
- None - all claims are verifiable from primary or secondary sources above

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - obsidian package is the only dependency; already installed and used
- Architecture: HIGH - patterns derived directly from Obsidian API type definitions and existing project code
- Pitfalls: HIGH for API/file I/O pitfalls (sourced from API docs + established project patterns); MEDIUM for prompt engineering pitfalls (LLM output reliability is inherently variable)
- Token budgets: MEDIUM - gpt-4o-mini context confirmed, but exact thresholds are tunable heuristics

**Research date:** 2026-03-09
**Valid until:** 2026-06-09 (Obsidian API is stable; OpenAI model specs may change if model is deprecated)

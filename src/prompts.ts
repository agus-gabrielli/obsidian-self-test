/**
 * All LLM prompt templates and render function.
 * generation.ts imports from here and delegates prompt construction.
 */

// ---------------------------------------------------------------------------
// Core render utility
// ---------------------------------------------------------------------------

/**
 * Replaces {{key}} placeholders in a template string with values from vars.
 * Unknown keys are replaced with an empty string.
 */
export function render(template: string, vars: Record<string, string>): string {
    let result = template;
    for (const [key, value] of Object.entries(vars)) {
        result = result.split(`{{${key}}}`).join(value);
    }
    // Remove any remaining unmatched placeholders
    result = result.replace(/\{\{[^}]+\}\}/g, '');
    return result;
}

// ---------------------------------------------------------------------------
// System message
// ---------------------------------------------------------------------------

export const SYSTEM_MESSAGE = 'You are an expert educator creating active recall study materials.';

// ---------------------------------------------------------------------------
// Conditional instruction builders
// ---------------------------------------------------------------------------

export function buildConceptMapInstruction(enabled: boolean): string {
    if (!enabled) return '';
    return `## Concept Map

Create a Mermaid mindmap diagram showing the key concepts and their relationships.
Use this exact syntax:

\`\`\`mermaid
mindmap
  root((Topic))
    Category A
      Concept 1
      Concept 2
    Category B
      Concept 3
\`\`\`

Rules:
- Root node: use the folder topic as the central concept
- Limit to 3-5 top-level categories maximum
- Each category should have 2-4 subconcepts maximum
- Order categories from general/foundational to specific/advanced
- Include only key concepts and important relationships - no exhaustive lists
- Use short labels (1-3 words per node)

---

`;
}

export function buildHintInstruction(enabled: boolean): string {
    if (!enabled) return '';
    return `- After each question, add a collapsible hint using this exact callout syntax:
  > [!hint]-
  > Your hint text here
  (blank line required after the callout block)
- Hints must be contextual cues that situate the concept without revealing the answer.
- Good hint example: "Think about the training loop - what happens after the forward pass computes the loss?"
- Hints should trigger recall through associations, context, or indirect cues.
- If a useful hint cannot be generated without being too obvious, omit the hint entirely for that question.`;
}

export function buildCheckInstruction(enabled: boolean): string {
    if (!enabled) return '';
    return `- After each hint (or question if hints are disabled), add a collapsible reference answer with a blank line before it:

  > [!check]-
  > Your reference answer here
- Reference answers should provide explanations that help understanding, not just validate the answer. Add context or clarifications when relevant to reinforce learning.
- At the end of each reference answer, add a source line using Obsidian wiki-link syntax referencing which note(s) the answer is based on. Format: Source: [[Note A]], [[Note B]]
- The note names come from the === Note: name === headers in the content above.`;
}

export function buildLanguageInstruction(language: string): string {
    if (!language) return '';
    return `\nWrite all output in ${language}.`;
}

export function buildCustomInstruction(instructions: string): string {
    if (!instructions) return '';
    return `\n${instructions}`;
}

// ---------------------------------------------------------------------------
// Batch template
// ---------------------------------------------------------------------------

export const batchTemplate = `{{noteBlocks}}

---

You are creating an active recall self-test from the notes above. Follow these instructions exactly:

{{conceptMapInstruction}}Generate questions that cover ALL the material in the notes above. Do not limit yourself to a fixed number of questions per category - produce as many questions as needed so that every key concept, fact, relationship, and application in the notes is tested at least once. The goal is comprehensive coverage: a student using this self-test should be able to verify recall of everything in the notes.

Each question must be:
- Open-ended (no multiple choice, no true/false, no fill-in-the-blank)
- Short answer - answerable in 1-3 sentences
- Minimal prompt - keep the question itself brief and direct, no lengthy preambles

Use these category headings (H2 markdown):
## Conceptual
## Relationships
## Application

Omit any category heading when the content is too simple or too narrow to warrant it.

Within each category, order questions from general and simple to complex and specific. Number questions within each category (1. 2. 3.).
{{hintInstruction}}
{{checkInstruction}}

Output raw markdown only. Do not wrap output in code fences.{{languageInstruction}}{{customInstruction}}`;

// ---------------------------------------------------------------------------
// Synthesis template
// ---------------------------------------------------------------------------

export const synthesisTemplate = `{{noteBlocks}}

---

You are receiving multiple partial question sets from a large folder of notes. Synthesize them into a single, unified self-test by:
1. Deduplicating overlapping or redundant questions
2. Reordering all questions from foundational to advanced
3. Improving overall coherence and flow
4. Organizing into category headings (omit any category when content is too simple or narrow):

{{conceptMapInstruction}}## Conceptual
## Relationships
## Application

Cover ALL the material - produce as many questions as needed so every key concept, fact, relationship, and application is tested. Each question must be open-ended, short answer (1-3 sentences), and minimal prompt (brief and direct). Number questions within each category (1. 2. 3.). Within each category, order questions from general and simple to complex and specific.
{{hintInstruction}}
{{checkInstruction}}

Output raw markdown only. Do not wrap output in code fences.{{languageInstruction}}{{customInstruction}}`;

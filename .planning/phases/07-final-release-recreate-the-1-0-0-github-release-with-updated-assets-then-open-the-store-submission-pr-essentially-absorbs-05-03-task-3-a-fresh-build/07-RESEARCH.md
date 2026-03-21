# Phase 7: Provider Settings and Migration - Research

**Researched:** 2026-03-21
**Domain:** Obsidian plugin settings API, TypeScript interface evolution, settings migration
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Settings UI layout**
- Provider dropdown at top of Connection section; below it, show only the active provider's API key field and model dropdown
- Switching providers calls `this.display()` to instantly re-render with the new provider's fields (same pattern as custom model toggle in Phase 6)
- API key placeholder is provider-specific: `sk-...` for OpenAI, `AIza...` for Gemini, `sk-ant-...` for Claude
- Model dropdown description updates per provider (e.g., "OpenAI model to use" / "Gemini model to use" / "Claude model to use")
- Provider dropdown labels: "OpenAI", "Gemini", "Claude (Anthropic)"

**Curated model lists**
- OpenAI: keep existing list (gpt-5.4, gpt-5.4-mini, gpt-5.4-nano, gpt-4.1, gpt-4.1-mini, gpt-4.1-nano, gpt-4o, gpt-4o-mini)
- Gemini: gemini-2.5-pro, gemini-2.5-flash, gemini-2.0-flash, gemini-2.0-flash-lite
- Claude: claude-opus-4-6, claude-sonnet-4-6, claude-haiku-4-5
- All three providers get the "Custom model..." option at the bottom (same Phase 6 pattern)
- Default models for new selections: OpenAI = gpt-5.4-mini (existing), Gemini = gemini-2.5-flash, Claude = claude-sonnet-4-6

**Migration experience**
- Silent migration - no notice or notification shown to the user
- Migration logic: if flat `apiKey` exists and `openai.apiKey` does not, copy flat `apiKey` and `model` to `openai.apiKey` and `openai.model`
- Custom model strings are preserved exactly as-is (no mapping to curated list)
- Old flat fields (`apiKey`, `model`) are cleaned up from data.json on next save
- Migration must be the first code change applied during settings load

**Settings data shape**
- `LLMProvider = 'openai' | 'gemini' | 'anthropic'` (internal key is `'anthropic'`, not `'claude'`)
- Nested `ProviderConfig { apiKey: string; model: string }` per provider
- No custom endpoint/baseUrl field - out of scope for v2.0
- Settings interface shape:
  ```typescript
  interface ActiveRecallSettings {
    provider: LLMProvider;
    openai:    { apiKey: string; model: string };
    gemini:    { apiKey: string; model: string };
    anthropic: { apiKey: string; model: string };
    language: string;
    generateHints: boolean;
    generateReferenceAnswers: boolean;
    generateConceptMap: boolean;
    customInstructions: string;
  }
  ```

### Claude's Discretion
- Exact migration timing within loadSettings() flow
- Whether to use a shared `ProviderConfig` interface or inline the shape
- How to structure the per-provider curated model lists (const arrays vs config object)
- CSS adjustments for provider-specific field rendering (if any needed)

### Deferred Ideas (OUT OF SCOPE)
- Custom endpoint/baseUrl per provider - out of scope for v2.0
- Dynamic model list from API calls - rejected in Phase 6, remains deferred
- Older Claude models (3.5 Sonnet, 3.5 Haiku) in curated list - can add if users request
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PROV-01 | User can select LLM provider (OpenAI, Gemini, Claude) from a dropdown in settings | Settings UI pattern from Phase 6 directly reusable; `addDropdown` with `onChange` calling `this.display()` |
| PROV-02 | User can configure a separate API key for each provider (keys persist independently) | Nested `ProviderConfig` schema in `DEFAULT_SETTINGS`; `onChange` writes to `settings[provider].apiKey` not flat field |
| PROV-03 | User can select from a curated model list per provider (with custom model option) | Phase 6 `CURATED_MODELS` + `CUSTOM_MODEL_VALUE` pattern replicated per provider via a config object |
| PROV-07 | Existing v1.0 users' OpenAI API key and model are migrated automatically on first v2.0 load | `Object.assign` shallow-merge vulnerability; migration must run before `Object.assign` in `loadSettings()` |
</phase_requirements>

## Summary

Phase 7 is a settings-only refactor. No new API calls are introduced - those come in Phase 8. The work involves three concrete changes: (1) expanding the `ActiveRecallSettings` interface from flat `apiKey`/`model` fields to a nested per-provider shape, (2) rewriting `display()` in `settings.ts` to render provider-specific fields using the already-proven re-render pattern from Phase 6, and (3) adding a one-time migration in `loadSettings()` that silently copies v1 flat fields into the new `openai` slot.

The biggest risk in this phase is the migration ordering problem. The current `loadSettings()` uses `Object.assign({}, DEFAULT_SETTINGS, savedData)`. If `DEFAULT_SETTINGS` is updated to include nested `openai: { apiKey: '', model: '' }` before the migration check runs, the shallow merge will create `openai: {}` from `DEFAULT_SETTINGS` which does NOT trigger the migration condition. Migration must inspect raw `savedData` before any merge with defaults.

The codebase is well-understood from reading all source files. All integration points are known: `generation.ts` calls `callLLM(this.settings.apiKey, this.settings.model, ...)` which must be updated to `callLLM(this.settings[this.settings.provider].apiKey, ...)`, and `sidebar.ts` does not reference `apiKey` directly.

**Primary recommendation:** Run migration against raw `loadData()` result before calling `Object.assign`; use a per-provider config object (`PROVIDER_CONFIG`) keyed by `LLMProvider` to hold model lists, labels, and placeholders - eliminates per-provider switch statements in `display()`.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| obsidian | latest (pinned in package.json) | Plugin settings API (`PluginSettingTab`, `Setting`, `addDropdown`, `addText`) | Only option for Obsidian plugin UI |
| TypeScript | ^5.8.3 | Type-safe interface evolution | Project standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Jest + ts-jest | 30.x / 29.x | Unit tests for migration logic and settings helpers | All new pure functions |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Per-provider config object | Switch statements in display() | Config object collapses 3x duplicated switch arms; prefer it |
| Shared `ProviderConfig` interface | Inline `{ apiKey: string; model: string }` per field | Interface is reusable and clarifies intent; prefer it |

**Installation:** No new packages needed. All dependencies already present.

## Architecture Patterns

### Recommended Project Structure
No new files needed. All changes confined to:
```
src/
├── settings.ts   -- interface expansion, DEFAULT_SETTINGS update, display() rewrite
├── main.ts       -- loadSettings() migration logic
└── generation.ts -- callLLM() call sites updated to read from nested provider config
```

### Pattern 1: Per-Provider Config Object

**What:** A single `PROVIDER_CONFIG` object keyed by `LLMProvider` holds model list, default model, API key placeholder, and display label for each provider. `display()` looks up the active provider's config rather than branching.

**When to use:** Any time display() needs provider-specific data - avoids 3x duplicated conditional blocks.

**Example:**
```typescript
// In settings.ts
const CUSTOM_MODEL_VALUE = '__custom__';

interface ProviderMeta {
    label: string;
    models: string[];
    defaultModel: string;
    placeholder: string;
    modelDesc: string;
}

const PROVIDER_CONFIG: Record<LLMProvider, ProviderMeta> = {
    openai: {
        label: 'OpenAI',
        models: ['gpt-5.4', 'gpt-5.4-mini', 'gpt-5.4-nano', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'gpt-4o', 'gpt-4o-mini'],
        defaultModel: 'gpt-5.4-mini',
        placeholder: 'sk-...',
        modelDesc: 'OpenAI model to use for generation.',
    },
    gemini: {
        label: 'Gemini',
        models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'],
        defaultModel: 'gemini-2.5-flash',
        placeholder: 'AIza...',
        modelDesc: 'Gemini model to use for generation.',
    },
    anthropic: {
        label: 'Claude (Anthropic)',
        models: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5'],
        defaultModel: 'claude-sonnet-4-6',
        placeholder: 'sk-ant-...',
        modelDesc: 'Claude model to use for generation.',
    },
};
```

### Pattern 2: Migration Before Merge

**What:** `loadSettings()` calls `loadData()` directly to get raw saved data, runs the migration check against it, then builds the final settings via `Object.assign`.

**When to use:** Always - this ordering is mandatory. The migration condition checks `savedData.apiKey` which only exists on v1 data. If `Object.assign` runs first with a `DEFAULT_SETTINGS` that has nested provider fields, the result loses the flat `apiKey` field.

**Example:**
```typescript
// In main.ts
async loadSettings() {
    const savedData = (await this.loadData()) as Record<string, unknown> | null ?? {};

    // PROV-07: Migrate v1 flat apiKey/model to openai nested config
    // Must run before Object.assign to avoid DEFAULT_SETTINGS overwriting detection
    if (savedData['apiKey'] && !(savedData['openai'] as Record<string, unknown>)?.['apiKey']) {
        savedData['openai'] = {
            apiKey: savedData['apiKey'] as string,
            model: (savedData['model'] as string) ?? 'gpt-5.4-mini',
        };
        // Flat fields removed on next saveSettings() via Object.assign with new shape
    }

    this.settings = Object.assign({}, DEFAULT_SETTINGS, savedData) as ActiveRecallSettings;
}
```

### Pattern 3: Provider-Scoped Display Rendering

**What:** `display()` reads `this.plugin.settings.provider` to look up the active `ProviderMeta`, then renders a single API key field and a single model dropdown for that provider. Switching the provider dropdown calls `this.display()` and saves the new provider (same pattern used by custom model toggle in Phase 6).

**Example:**
```typescript
// In display() - Connection section
const activeProvider = this.plugin.settings.provider;
const meta = PROVIDER_CONFIG[activeProvider];
const providerSettings = this.plugin.settings[activeProvider];
const isCustomModel = !meta.models.includes(providerSettings.model);

new Setting(containerEl)
    .setName('Provider')
    .addDropdown(drop => {
        for (const [key, cfg] of Object.entries(PROVIDER_CONFIG)) {
            drop.addOption(key, cfg.label);
        }
        drop.setValue(activeProvider);
        drop.onChange(async (value) => {
            this.plugin.settings.provider = value as LLMProvider;
            await this.plugin.saveSettings();
            this.display();
        });
    });

new Setting(containerEl)
    .setName('API Key')
    .setDesc('Stored in data.json inside your vault. Do not commit this file to a public git repository.')
    .addText(text => {
        text.inputEl.type = 'password';
        text
            .setPlaceholder(meta.placeholder)
            .setValue(providerSettings.apiKey)
            .onChange(async (value) => {
                this.plugin.settings[activeProvider].apiKey = value;
                await this.plugin.saveSettings();
            });
    });
```

### Pattern 4: callLLM Integration Point Update

**What:** `GenerationService.generate()` currently passes `this.settings.apiKey` and `this.settings.model` to `callLLM()`. These flat fields are removed from the interface; the calls must be updated to read from the active provider's nested config.

**Example:**
```typescript
// In generation.ts - GenerationService.generate()
// Before (Phase 6):
const partial = await callLLM(this.settings.apiKey, this.settings.model, messages);

// After (Phase 7):
const providerCfg = this.settings[this.settings.provider];
const partial = await callLLM(providerCfg.apiKey, providerCfg.model, messages);
```

Note: `callLLM()` signature stays the same (`apiKey, model, messages`). Only the call sites change. Phase 8 will later refactor `callLLM()` internals for Gemini/Anthropic routing.

### Anti-Patterns to Avoid

- **Merging before migrating:** Do not update `DEFAULT_SETTINGS` to include nested provider keys without guarding the migration. `Object.assign({}, DEFAULT_SETTINGS, savedData)` where `DEFAULT_SETTINGS.openai = { apiKey: '', ... }` and `savedData` has no `openai` key results in an empty `openai` block and the migration check `!savedData.openai?.apiKey` becomes unreachable via the merged result if you inspect merged rather than raw.
- **Checking `this.settings.apiKey` post-migration:** After Phase 7, `apiKey` no longer exists on `ActiveRecallSettings`. Any code still referencing `settings.apiKey` (generation.ts call sites, any validation in sidebar.ts) must be updated in the same task as the interface change to avoid TypeScript errors.
- **Per-provider re-render without saving provider first:** The provider dropdown `onChange` must `saveSettings()` before calling `this.display()`, otherwise the displayed fields reflect the new provider but the saved provider is still the old one.
- **Forgetting `customModel` field cleanup:** Phase 6 introduced `settings.customModel` (verified in STATE.md entry for 06-04). The new shape does not have a flat `customModel` - custom model strings live in `openai.model` / `gemini.model` / `anthropic.model`. Check if `customModel` was added to the interface and handle the deprecation.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Settings persistence | Manual file I/O | `plugin.loadData()` / `plugin.saveData()` | Already abstracted; handles vault-relative data.json path |
| UI re-render on change | Manual DOM diffing | `this.display()` re-render pattern | Already proven in Phase 6 for model dropdown |
| Provider-specific rendering | Inline switch/if chains | `PROVIDER_CONFIG` lookup | Switch chains diverge as providers are added; config object scales |

**Key insight:** The Obsidian settings API handles all persistence and DOM concerns. The only new logic is migration (pure data transform) and conditional field rendering (already solved by Phase 6 pattern).

## Common Pitfalls

### Pitfall 1: Object.assign Shallow-Merge Loses Migration Trigger

**What goes wrong:** `loadSettings()` updates `DEFAULT_SETTINGS` to include `openai: { apiKey: '', model: 'gpt-5.4-mini' }`. When `Object.assign({}, DEFAULT_SETTINGS, savedData)` runs on v1 data, `savedData` has no `openai` key, so the merged result gets `openai: { apiKey: '', model: 'gpt-5.4-mini' }` from defaults. The migration check `if (savedData.apiKey && !savedData.openai?.apiKey)` evaluates against the merged object and sees `openai.apiKey = ''` - migration never fires.

**Why it happens:** The developer reads `this.settings` (post-merge) instead of the raw `loadData()` result.

**How to avoid:** Capture raw `savedData = await this.loadData()`, run the migration transform on `savedData` before calling `Object.assign`, then assign to `this.settings`.

**Warning signs:** Unit test for migration with v1 data shape passes in isolation but fails when `DEFAULT_SETTINGS` includes nested provider fields.

### Pitfall 2: TypeScript Compile Error on Removed Flat Fields

**What goes wrong:** After removing `apiKey` and `model` from `ActiveRecallSettings`, TypeScript immediately flags `this.settings.apiKey` in `generation.ts` (3 call sites) and any validation references in `sidebar.ts`.

**Why it happens:** Interface change and call site update done in separate commits without a full TypeScript check between.

**How to avoid:** Update interface AND all call sites in the same task. Run `tsc -noEmit` after each task as the verification step.

**Warning signs:** Build fails after interface update.

### Pitfall 3: `customModel` Field Orphaned

**What goes wrong:** Phase 6 added `settings.customModel` (per STATE.md 2026-03-18 06-04 entry: "Custom model input persists via settings.customModel"). The v2 settings shape removes this flat field. A v1.x user who set a custom model would lose it on upgrade if the migration doesn't handle it.

**Why it happens:** Migration logic only handles `apiKey` and `model`, not `customModel`.

**How to avoid:** In the migration check, if `savedData.customModel` exists (non-empty string), copy it to `savedData.openai.model` instead of the flat `model` value. Verify by reading the current `DEFAULT_SETTINGS` - if `customModel` is in it, migrate it too.

**Warning signs:** Migration test with custom model string produces empty `openai.model`.

### Pitfall 4: Default Model for Existing OpenAI Users

**What goes wrong:** A v1 user has `model: 'gpt-4o-mini'` in data.json. After migration, `openai.model` should be `'gpt-4o-mini'`. If the migration copies `savedData.model ?? DEFAULT_SETTINGS.openai.model`, the fallback is fine. But if `savedData.model` is an empty string (valid v1 state if user cleared it), the migration writes `openai.model: ''` and the custom model input appears on next open.

**Why it happens:** Empty string is falsy in JS; `savedData.model || defaultModel` silently replaces a deliberately-empty model.

**How to avoid:** Use `savedData.model !== undefined ? savedData.model : defaultModel` - explicit undefined check rather than truthiness.

## Code Examples

Verified patterns from existing codebase:

### Existing Re-render Pattern (Phase 6, confirmed in settings.ts)
```typescript
// Source: src/settings.ts lines 90-101
drop.onChange(async (value) => {
    if (value === CUSTOM_MODEL_VALUE) {
        this.plugin.settings.model = '';
        await this.plugin.saveSettings();
        this.display();
        return;
    }
    this.plugin.settings.model = value;
    await this.plugin.saveSettings();
    this.display();
});
```

### Existing Password Field Pattern (confirmed in settings.ts)
```typescript
// Source: src/settings.ts lines 68-76
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
```

### Existing loadSettings Pattern (confirmed in main.ts)
```typescript
// Source: src/main.ts lines 99-101
async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<ActiveRecallSettings>);
}
```

### Generation callLLM Call Sites (confirmed in generation.ts)
```typescript
// Source: src/generation.ts lines 199, 207, 212 - THREE sites to update
finalContent = await callLLM(this.settings.apiKey, this.settings.model, messages);
const partial = await callLLM(this.settings.apiKey, this.settings.model, messages);
finalContent = await callLLM(this.settings.apiKey, this.settings.model, synthesisMessages);
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 30.x + ts-jest 29.x |
| Config file | `jest.config.cjs` |
| Quick run command | `npx jest --testPathPattern=settings` |
| Full suite command | `npx jest` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PROV-01 | Provider dropdown renders; switching provider saves new provider | unit | `npx jest --testPathPattern=settings` | Wave 0 |
| PROV-02 | API key for each provider persists independently; switching providers does not overwrite other keys | unit | `npx jest --testPathPattern=settings` | Wave 0 |
| PROV-03 | Model dropdown shows correct curated list per provider; custom model option present; custom model text input shown when non-curated model set | unit | `npx jest --testPathPattern=settings` | Wave 0 |
| PROV-07 | Migration: v1 flat `apiKey` copied to `openai.apiKey`; `model` copied to `openai.model`; custom model string preserved; no migration run on fresh v2 install | unit | `npx jest --testPathPattern=settings` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx jest`
- **Per wave merge:** `npx jest`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/__tests__/settings.test.ts` - covers PROV-01, PROV-02, PROV-03, PROV-07 (migration logic and settings display helpers)

Note: `display()` relies on Obsidian's `Setting` class DOM API. The existing `obsidian.ts` mock does not mock `PluginSettingTab` or `Setting`. Migration logic in `loadSettings()` is pure data manipulation and fully testable without DOM. Extract migration into a pure helper function `migrateSettings(savedData: Record<string, unknown>): void` to make it unit-testable independently of the Obsidian mock layer.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Flat `apiKey`, `model` on settings interface | Nested `openai/gemini/anthropic` with `{ apiKey, model }` | Phase 7 | All read sites must use `settings[settings.provider].apiKey` |
| Single `CURATED_MODELS` array | `PROVIDER_CONFIG` record keyed by `LLMProvider` | Phase 7 | display() becomes data-driven |
| `LLMProvider = 'openai'` | `LLMProvider = 'openai' \| 'gemini' \| 'anthropic'` | Phase 7 | TypeScript union guards provider switching |

**Deprecated/outdated:**
- Flat `apiKey` field on `ActiveRecallSettings`: replaced by nested provider configs in Phase 7
- Flat `model` field on `ActiveRecallSettings`: replaced by nested provider configs in Phase 7
- `settings.customModel` (Phase 6 addition): subsumed into `settings[provider].model` - check if this field exists on the current interface before deciding how to handle

## Open Questions

1. **Does `customModel` field exist on the current `ActiveRecallSettings` interface?**
   - What we know: STATE.md 2026-03-18 entry says "Custom model input persists via settings.customModel" but `settings.ts` source (read directly) does NOT show `customModel` in the interface - the Phase 6 implementation stored the custom model string directly in `settings.model`
   - What's unclear: Was `customModel` added to the interface but not reflected in the file snapshot, or did the implementation use `model` directly?
   - Recommendation: Confirm against current `settings.ts` before writing migration. Based on the source read, `model` holds the custom string directly - no separate `customModel` field. If that's still true, migration is simpler: `openai.model = savedData.model`.

2. **Does `sidebar.ts` reference `settings.apiKey` anywhere for validation?**
   - What we know: Reading `sidebar.ts` in full shows no reference to `settings.apiKey` - the sidebar only calls `generationService.generate()` and does not validate the key itself
   - What's unclear: Nothing - this appears clean
   - Recommendation: No change needed in `sidebar.ts` for this phase.

## Sources

### Primary (HIGH confidence)
- Direct read of `src/settings.ts` - complete interface and display() implementation
- Direct read of `src/main.ts` - loadSettings() pattern
- Direct read of `src/generation.ts` - all three callLLM call sites identified
- Direct read of `src/sidebar.ts` - confirmed no apiKey references
- Direct read of `.planning/phases/07-.../07-CONTEXT.md` - all locked decisions
- Direct read of `.planning/STATE.md` - migration check pattern, critical pitfalls

### Secondary (MEDIUM confidence)
- `.planning/REQUIREMENTS.md` - PROV-01/02/03/07 requirement text
- Phase 6 STATE.md session log entry for customModel behavior

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all from direct codebase reads
- Architecture: HIGH - migration pattern verified against actual loadSettings() code; re-render pattern verified against actual display() code
- Pitfalls: HIGH - Object.assign shallow-merge behavior is JavaScript spec; call site count verified by direct read

**Research date:** 2026-03-21
**Valid until:** Stable - no external dependencies to expire; valid until Phase 8 begins

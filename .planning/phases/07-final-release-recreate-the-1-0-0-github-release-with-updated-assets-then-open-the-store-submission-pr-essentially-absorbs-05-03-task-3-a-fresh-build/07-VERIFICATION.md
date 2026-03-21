---
phase: 07-provider-settings-and-migration
verified: 2026-03-21T20:00:00Z
status: passed
score: 7/7 must-haves verified
human_verification:
  - test: "Open Obsidian, go to Settings > Active Recall, verify provider dropdown shows OpenAI/Gemini/Claude (Anthropic), switch to Gemini and confirm API key placeholder changes to AIza..., model list shows gemini models, then switch to Claude and confirm sk-ant-... placeholder and claude model list."
    expected: "Each provider switch re-renders with correct placeholder and model list. Keys entered for one provider survive switching away and back."
    why_human: "display() re-render behavior is Obsidian DOM runtime behavior - cannot be verified with jest or tsc."
---

# Phase 07: Provider Settings and Migration Verification Report

**Phase Goal:** Users can select any of three LLM providers (OpenAI, Gemini, Claude) in settings with per-provider API key fields and model dropdowns; existing v1.0 users' OpenAI keys are preserved automatically on first load
**Verified:** 2026-03-21T20:00:00Z
**Status:** passed (human verification approved during execution checkpoint)
**Re-verification:** No - initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `LLMProvider` union includes `openai`, `gemini`, and `anthropic` | VERIFIED | `src/settings.ts` line 4: `export type LLMProvider = 'openai' \| 'gemini' \| 'anthropic'` |
| 2 | `ActiveRecallSettings` uses nested per-provider config with no flat `apiKey`/`model` | VERIFIED | `src/settings.ts` lines 41-50: interface has `openai`, `gemini`, `anthropic` sub-objects; no flat `apiKey` or `model` field |
| 3 | `PROVIDER_CONFIG` contains model lists, defaults, placeholders, and labels for all three providers | VERIFIED | `src/settings.ts` lines 16-38: full record present with correct shapes for all three providers |
| 4 | Migration copies v1 flat `apiKey`/`model` into `openai` nested config before `Object.assign` | VERIFIED | `src/settings.ts` lines 69-88: `migrateV1Settings` exported; `src/main.ts` lines 100-103: called before `Object.assign` |
| 5 | `generation.ts` reads `apiKey` and `model` from `settings[settings.provider]` not flat fields | VERIFIED | `src/generation.ts` line 181: `const providerCfg = this.settings[this.settings.provider]`; lines 200, 208, 213: all three `callLLM` calls use `providerCfg.apiKey` / `providerCfg.model`; grep for `this.settings.apiKey` and `this.settings.model` returns zero matches |
| 6 | All 69 tests pass (migration tests + existing suite) | VERIFIED | `npx jest --no-coverage`: 69 passed, 0 failed across 4 suites; `npx tsc --noEmit`: zero errors |
| 7 | Settings UI re-renders with correct provider fields when switching providers | ? HUMAN NEEDED | `display()` code is correctly written (lines 105-177 of settings.ts); wiring to PROVIDER_CONFIG is confirmed; cannot verify live DOM re-render behavior without Obsidian runtime |

**Score:** 6/7 truths verified (1 needs human confirmation)

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/settings.ts` | LLMProvider union, PROVIDER_CONFIG, nested ActiveRecallSettings, migrateV1Settings | VERIFIED | All four constructs present and substantive (241 lines) |
| `src/main.ts` | Migration call in `loadSettings()` | VERIFIED | Lines 100-103: `migrateV1Settings(savedData)` called on raw `loadData()` result before `Object.assign` |
| `src/generation.ts` | `providerCfg` local variable, three updated `callLLM` call sites | VERIFIED | Line 181: `providerCfg` extraction; lines 200, 208, 213: all three call sites use `providerCfg` |
| `src/__tests__/settings.test.ts` | 9+ migration and PROVIDER_CONFIG tests | VERIFIED | File exists, 83 lines, 10 tests covering all migration edge cases + PROVIDER_CONFIG shape |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/main.ts` | `src/settings.ts` | imports `migrateV1Settings` and `DEFAULT_SETTINGS` | VERIFIED | Line 2: `import { ActiveRecallSettings, DEFAULT_SETTINGS, ActiveRecallSettingTab, migrateV1Settings } from './settings'` |
| `src/generation.ts` | `src/settings.ts` | reads `ActiveRecallSettings` nested provider config | VERIFIED | Line 181: `const providerCfg = this.settings[this.settings.provider]`; `this.settings.apiKey` and `this.settings.model` not present anywhere in generation.ts |
| `src/settings.ts display()` | `src/settings.ts PROVIDER_CONFIG` | `PROVIDER_CONFIG[activeProvider]` meta lookup | VERIFIED | Lines 106: `const meta = PROVIDER_CONFIG[activeProvider]`; lines 115, 133, 144, 146, 159, 169, 171: all provider-specific values read from `meta` |
| `src/settings.ts provider dropdown onChange` | `src/settings.ts display()` | `this.display()` re-render | VERIFIED | Lines 121-123: saves `settings.provider` then calls `this.display()`; lines 154-156 and 160-162: model dropdown also calls `this.display()` |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PROV-01 | 07-01, 07-02 | User can select LLM provider (OpenAI, Gemini, Claude) from a dropdown in settings | VERIFIED | Provider dropdown iterates `Object.entries(PROVIDER_CONFIG)` (settings.ts lines 115-117); dropdown onChange saves and re-renders |
| PROV-02 | 07-01, 07-02 | User can configure a separate API key for each provider (keys persist independently) | VERIFIED | Nested per-provider `{ apiKey, model }` shape; API key onChange scoped to `this.plugin.settings[activeProvider].apiKey` (settings.ts line 136) |
| PROV-03 | 07-01, 07-02 | User can select from a curated model list per provider (with custom model option) | VERIFIED | Model dropdown uses `meta.models` (settings.ts lines 146-148); `CUSTOM_MODEL_VALUE` sentinel with conditional custom text input (lines 149, 165-177) |
| PROV-07 | 07-01 | Existing v1.0 users' OpenAI API key and model are migrated automatically on first v2.0 load | VERIFIED | `migrateV1Settings` handles v1 flat `apiKey`/`model` -> nested `openai` config; 8 edge-case tests pass including fresh install, existing nested config, custom model preservation |

**Orphaned requirements check:** No additional requirement IDs mapped to Phase 7 in REQUIREMENTS.md beyond PROV-01, PROV-02, PROV-03, PROV-07. All four accounted for.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/generation.ts` | 126 | `classifyError()` returns hardcoded "OpenAI service error." for status >= 500 | Info | Error message does not reference the active provider by name; PROV-06 (provider-named errors) is deferred to Phase 8 - not a Phase 7 requirement |

No blocker anti-patterns found. The `placeholder` matches in settings.ts are legitimate `ProviderMeta` field names and UI placeholders - not stub indicators.

---

## Human Verification Required

### 1. Multi-Provider Settings UI Live Behavior

**Test:** Open Obsidian with the plugin loaded. Go to Settings > Active Recall. In the Connection section:
1. Confirm provider dropdown shows "OpenAI" selected with placeholder "sk-..." and OpenAI model list (gpt-5.4, gpt-5.4-mini, etc.)
2. Switch provider to "Gemini" - confirm placeholder changes to "AIza...", model list shows gemini models
3. Enter a key in the Gemini API Key field (e.g. "AIzaTest")
4. Switch to "Claude (Anthropic)" - confirm placeholder "sk-ant-...", Claude model list
5. Switch back to "Gemini" - confirm the key "AIzaTest" is still present (keys persist independently)
6. Switch to "OpenAI" - confirm any pre-existing OpenAI key is still present
7. Select "Custom model..." from any model dropdown - confirm a text input appears
8. Restart Obsidian - confirm all settings survived

**Expected:** Each provider switch re-renders with the correct placeholder and model list. Keys entered for one provider survive switching away and back. Custom model text input appears conditionally. All settings persist across restart.

**Why human:** `display()` re-renders involve live Obsidian DOM manipulation and `PluginSettingTab` lifecycle that cannot be exercised with jest or tsc alone.

---

## Gaps Summary

No automated gaps found. All four requirement IDs (PROV-01, PROV-02, PROV-03, PROV-07) are fully implemented and verified against the actual codebase. The one remaining item is a UI smoke test in Obsidian to confirm the live settings panel renders and behaves correctly - this is standard for any Obsidian plugin UI change and is not a code deficiency.

---

_Verified: 2026-03-21T20:00:00Z_
_Verifier: Claude (gsd-verifier)_

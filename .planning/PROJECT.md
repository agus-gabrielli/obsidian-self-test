# Obsidian Active Recall Plugin

## What This Is

An Obsidian community plugin that helps users learn from their own notes through active recall. It reads markdown notes from a selected folder, sends the content to an LLM, and generates a `_self-test.md` file with open-ended questions, hints, reference answers, and a concept map — all in standard Obsidian markdown. The plugin targets publication to the Obsidian community plugin store.

## Core Value

Users can generate a structured self-test from any folder of notes in one click, turning passive note review into active recall practice.

## Current Milestone: v2.0 Multi-Provider & Flexible Collection

**Goal:** Add multi-provider LLM support (Gemini, Claude) and flexible note collection modes (by tag, by linked notes, single note), then release to the Obsidian community store.

**Target features:**
- Google Gemini support via Google AI Studio API (generativelanguage.googleapis.com)
- Anthropic Claude support via native Anthropic Messages API (api.anthropic.com)
- Generation by tag - collect all notes sharing a tag, output to _self-tests/ folder
- Generation by linked notes - select a root/MOC note, follow depth-1 links (optional depth-2)
- Single note generation
- Final release to Obsidian community plugin store (moved from v1.0 phase 7)

## Requirements

### Validated

- User can generate a `_self-test.md` by selecting a folder from the sidebar or command palette (v1.0)
- Plugin reads all top-level `.md` files in the selected folder (v1.0)
- LLM generates open-ended recall questions with hints, reference answers, and concept maps (v1.0)
- Context window management: batch + synthesize for large folders (v1.0)
- Plugin settings tab with provider, API key, model, language, toggles, custom instructions (v1.0)
- Sidebar panel with Generate/Regenerate buttons per folder (v1.0)
- All entry points wired: command palette, context menu, sidebar (v1.0)
- OpenAI provider fully working with curated model dropdown (v1.0)

### Active

- [ ] Gemini provider via Google AI Studio API
- [ ] Claude provider via native Anthropic Messages API
- [x] Provider selection in settings with per-provider API key and model configuration (Phase 7)
- [ ] Generation by tag - collect notes by tag, output to _self-tests/ folder
- [ ] Generation by linked notes from root/MOC note (depth 1, optional depth 2)
- [ ] Single note generation
- [ ] Final release to Obsidian community plugin store

### Out of Scope

- Spaced repetition scheduling - deferred to future (adds significant complexity)
- Content change detection in sidebar - future
- OpenAI-compatible proxy for Gemini/Claude - using native APIs instead
- Automatic backup of previous self-tests - user renames manually if needed
- Real-time sync or collaboration - out of scope entirely
- Recursive folder scanning - users control depth via folder structure

## Context

- Target: Obsidian community plugin store — requires `manifest.json`, README, semantic versioning, and adherence to Obsidian plugin guidelines
- LLM integration: user-provided API key, no bundled access; keeps plugin free and privacy-respecting
- Output format: all generated content is standard Obsidian-flavored markdown, fully portable if plugin is removed
- The testing effect (cognitive science): retrieval practice strengthens long-term retention more than passive review — this is the research motivation behind the plugin
- V2 spaced repetition metadata will live in `_self-test.md` YAML frontmatter (`last_review`, `next_review`, `review_count`, `review_interval_days`) — architecture should not conflict with this

## Constraints

- **Tech Stack**: TypeScript + Obsidian Plugin API — standard for all community plugins
- **Compatibility**: Must support Obsidian v1.0+ and both desktop and mobile (mobile caveat: API key input is less ergonomic on mobile but should still work)
- **Distribution**: Must pass Obsidian community plugin review process (no remote code execution, no external tracking, no bundled credentials)
- **Context Window**: Token budget heuristic is `chars / 4`; reserve ~20k tokens for prompt + output; remainder available for notes

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| OpenAI first, provider-abstracted | Largest community user base; abstraction allows Anthropic/custom later without refactoring | — Pending |
| Non-recursive folder reading | Keeps scope predictable; user controls depth by folder structure | — Pending |
| Overwrite on regeneration (no backup) | Simplest and most predictable; users can rename manually | — Pending |
| Batch + synthesize for large folders | Handles any folder size gracefully without hard limits | — Pending |
| `NoteSource` interface abstraction | Decouples collection mode from generation pipeline; v2 modes drop in | — Pending |
| Standard `.md` output only | Full portability; no lock-in to plugin-specific rendering | — Pending |

---
*Last updated: 2026-03-21 after Phase 7 completion (provider settings and migration)*

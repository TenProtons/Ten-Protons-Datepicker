# Datepicker Project Instructions

## Core Principles

- This is a **zero-dependency**, framework-agnostic datepicker (Vanilla TypeScript + Web Components).
- Optimize for **maximum developer productivity**, smallest possible bundle size, and excellent accessibility.
- Prefer pure functions, clear data flow, and explicit state over clever abstractions.
- Code updates must be **minimal, readable, and surgically precise** — no unrelated changes.
- Never break existing logic or public API without explicit approval.
- Follow DRY and SOLID principles strictly.
- Always consider edge cases (timezones, DST, invalid dates, RTL, screen readers, mobile keyboards, etc.).

## Architecture Rules

- Core must remain extremely small. Optional features (range, multiple, time, presets) must be tree-shakeable modules.
- Prefer Web Component as the primary public API, with a clean imperative class underneath.
- Do not introduce any runtime dependencies.
- Avoid premature abstractions. Only extract when duplication becomes real and painful.
- Keep the rendering layer simple and predictable (prefer direct DOM updates over virtual DOM or heavy reactivity).

## TypeScript & Code Quality

- Strict TypeScript is mandatory.
- Prefer explicit types over `any` or excessive type inference tricks.
- Public API must be fully typed and documented via JSDoc.
- Avoid complex generic magic unless it significantly improves DX.

## Accessibility & UX

- Accessibility is a first-class requirement, not an afterthought.
- Follow WAI-ARIA Date Picker pattern as closely as possible.
- Keyboard navigation and screen reader support must work correctly out of the box.
- Manual input must be first-class and reliable.

## Performance & Size

- Every kilobyte matters. Always think about gzipped size.
- Avoid unnecessary re-renders and DOM thrashing.
- Prefer CSS variables + minimal CSS over large style systems.

## Working Style

- When implementing features, first think about the simplest correct solution.
- Prefer extending existing code over rewriting.
- Do not add features that are not requested.
- Do not build / bundle the project unless explicitly asked.
- When fixing bugs, first reproduce the edge case clearly.

## What to Avoid

- Framework-specific patterns (Vue reactivity, React hooks, etc.)
- Heavy date libraries (date-fns, dayjs, luxon, moment)
- Over-engineering and unnecessary configuration options
- Breaking changes without discussion

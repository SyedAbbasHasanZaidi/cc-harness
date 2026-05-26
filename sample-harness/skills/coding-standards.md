# Coding Standards

## Core Principles

**Follow existing conventions first.** Before introducing a new pattern, look at how similar problems are already solved in the codebase. Consistency beats novelty.

**Explicit over implicit.** Name things clearly. Avoid clever abbreviations. A reader encountering code for the first time should understand its intent without needing the author to explain it.

**Small, focused units.** Functions do one thing. Modules have one clear responsibility. If you find yourself writing "and" in a function's description, it's doing too much.

## Naming

- Variables and functions: `camelCase` for JS/TS, `snake_case` for Python
- Types and classes: `PascalCase`
- Constants: `UPPER_SNAKE_CASE` for true constants, `camelCase` for config values
- Avoid abbreviations unless they're domain-standard (`url`, `id`, `api`)

## Error Handling

- Never swallow errors silently
- Every `catch` block either recovers with a sensible default or re-throws with added context
- User-facing error messages say what went wrong and what to do next

## Comments

- Code should explain what; comments explain why
- If you're about to write a comment explaining what the code does, rewrite the code instead
- Document non-obvious invariants, workarounds, and gotchas

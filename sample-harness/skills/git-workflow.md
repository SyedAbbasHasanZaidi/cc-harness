# Git Workflow

## Commit Messages

Follow the Conventional Commits specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer]
```

**Types:**
- `feat:` — new feature
- `fix:` — bug fix
- `refactor:` — code change that neither fixes a bug nor adds a feature
- `docs:` — documentation only changes
- `test:` — adding or fixing tests
- `chore:` — build process, dependency updates, tooling
- `perf:` — performance improvement
- `ci:` — CI configuration changes

## Branch Strategy

- `main` / `master` — always deployable
- `feat/<name>` — new feature work
- `fix/<name>` — bug fixes
- `chore/<name>` — maintenance, refactoring

## Before Every Commit

1. Run the test suite — all tests must pass
2. Run the linter — no new lint errors
3. Review the diff — no debug artifacts, no unintended changes
4. Write a clear commit message — future-you will thank present-you

## Pull Requests

- One PR per logical change
- Include a description of what changed and why
- Reference any related issues
- Ensure CI passes before requesting review

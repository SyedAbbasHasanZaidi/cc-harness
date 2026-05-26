# cc-harness

A CLI tool and terminal UI for managing Claude Code harnesses — analogous to `nvm` for Node versions.

**Core invariant:** `.claude/` in a project only ever contains the active harness. Everything else lives inert in `~/.cc-harnesses/`.

---

## Install

```bash
npm install -g cc-harness
# or use via npx
npx cc-harness --help
```

---

## CLI Quickstart

### 1. Install a harness

```bash
# From a local path
cc-harness install ./my-harness

# From npm (coming soon)
cc-harness install my-harness-package
```

### 2. Activate a harness for your project

```bash
cd your-project
cc-harness use my-harness
```

This copies the harness's `commands/` and `skills/` into `.claude/` and either:
- Creates `CLAUDE.md` with the harness block if no `CLAUDE.md` exists
- Prints the block to paste manually if `CLAUDE.md` already has user content

### 3. See what's installed

```bash
cc-harness list
# Installed harnesses:
#   my-harness   v1.0.0   [ACTIVE in this project]
#   other-harness  v0.3.1
```

### 4. Preview changes before activating

```bash
cc-harness diff my-harness
```

Shows files to add/remove and the CLAUDE.md block — makes no changes.

### 5. Deactivate

```bash
cc-harness unlink
```

Removes harness files from `.claude/` and handles `CLAUDE.md` cleanup safely.

---

## TUI Quickstart

Launch the interactive terminal UI:

```bash
cc-harness ui
```

```
┌─────────────────────────────────────────────────────────────────┐
│  cc-harness  ·  project: /Users/you/my-project                  │
├───────────────────────┬─────────────────────────────────────────┤
│  INSTALLED HARNESSES  │  my-harness                             │
│                       │  v1.0.0 · by @author                    │
│  ▶ my-harness ●       │                                         │
│    other-harness      │  React/Next.js + TypeScript harness     │
│                       │                                         │
│                       │  Skills:    3                           │
│                       │  Commands:  1                           │
│                       │                                         │
│                       │  ● ACTIVE IN THIS PROJECT               │
│                       │                                         │
│                       │  [Activate]  [Diff]  [Unlink]           │
├───────────────────────┴─────────────────────────────────────────┤
│  ↑↓ navigate · a activate · d diff · u unlink · q quit         │
└─────────────────────────────────────────────────────────────────┘
```

**Keyboard shortcuts:**

| Key | Action |
|---|---|
| `↑` / `↓` | Navigate harness list |
| `a` | Activate selected harness |
| `d` | Diff selected harness |
| `u` | Unlink active harness |
| `Tab` | Cycle button focus |
| `Enter` | Press focused button |
| `q` / `Escape` | Quit |

---

## Harness Package Format

Create a directory with:

### `cc-harness.json`

```json
{
  "name": "my-harness",
  "version": "1.0.0",
  "description": "My Claude Code harness",
  "author": "@me",
  "files": {
    "commands": "commands/",
    "skills": "skills/"
  },
  "claude_md_block": "claude-block.md"
}
```

### `claude-block.md`

Markdown content injected into (or printed for) `CLAUDE.md`. Wrapped in sentinel tags automatically.

### `commands/` and `skills/`

Markdown files that go into `.claude/commands/` and `.claude/skills/` respectively.

---

## CLAUDE.md Safety Guarantees

- **Never** writes to `~/.claude/CLAUDE.md`
- **Never** writes to any `CLAUDE.md` outside the detected project root
- **Never** modifies a `CLAUDE.md` that has existing user content
- **Never** removes content outside the cc-harness sentinel tags

---

## Sample Harness

See `sample-harness/` for a minimal working example you can use as a template.

```bash
cc-harness install ./sample-harness
cc-harness use cc-sample-harness
```

---

## Commands

| Command | Description |
|---|---|
| `install <source>` | Install from local path or npm package |
| `use <name>` | Activate harness for current project |
| `unlink` | Deactivate current project's harness |
| `list` | List all installed harnesses |
| `diff <name>` | Preview changes without making them |
| `ui` | Launch interactive TUI |

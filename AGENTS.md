# omnixenon-skills

Omnixenon's public Agent Skills, installable as a Claude Code plugin (`.claude-plugin/`). Each skill is `skills/<name>/SKILL.md`, with optional `references/*.md`.

## The gate is the spec
- Rules live in checks (`scripts/gate.ts`), not in this file. If something must hold, write a check.
- `bun run gate` is the one command: tests, tree audit, SKILL.md frontmatter, plugin manifests, caps. Make it pass.
- Caps (`scripts/caps.json`) only go down; never raise one to get green.
- Hooks: `bun run hooks` once per clone. pre-commit audits the staged tree, pre-push runs the gate. No hosted CI.

## Ephemeral
Notes, research and plans live outside the repo. This repo is public: nothing private goes in it.

## Never without asking
Publish, push, send, spend or delete.

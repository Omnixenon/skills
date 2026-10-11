# omnixenon-skills

An index of Omnixenon's public Agent Skills. Each skill lives in its own repo; `.claude-plugin/marketplace.json` lists them as github-sourced plugins, and README.md links each one.

## The gate is the spec
- Rules live in checks (`scripts/gate.ts`), not in this file. If something must hold, write a check.
- `bun run gate` is the one command: tests, tree audit, SKILL.md frontmatter (if any), marketplace entries, caps. Make it pass.
- Caps (`scripts/caps.json`) only go down; never raise one to get green.
- Hooks: `bun run hooks` once per clone. pre-commit audits the staged tree, pre-push runs the gate. No hosted CI.

## Ephemeral
Notes, research and plans live outside the repo. This repo is public: nothing private goes in it.

## Never without asking
Publish, push, send, spend or delete.

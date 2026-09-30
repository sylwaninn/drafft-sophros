# Instructions for AI agents

sophros: the drafft team's moderation and support dashboard. React Router 8 (framework mode) on
Cloudflare Workers, Tailwind 4. Everything it reads or changes goes through the `admin_*` functions of
the `drafft-backend` repository (migration `20260927000007_sophros.sql`): a new capability starts with a
function there, with its role check and its audit line, then a page here. See [README.md](README.md).

React Router and Workers APIs move fast: read `node_modules/react-router/docs/` and the `react-router`
skill (workspace `.claude/skills/react-router/`) before changing routes, loaders, actions or middleware.

## Workspace rules

This repository lives in the drafft workspace (the parent folder, see `../AGENTS.md`), which holds what
every repository shares: commit and GitHub rules (`../.claude/rules/`), the `create-pr` and `wording`
skills (`../.claude/skills/`), and the Claude Code settings and git guard (`../.claude/`). Start agents
there. In short: work on a branch, one-line commits `type(scope): description` without any
Co-Authored-By, a pull request into `staging`, verify first. The git hooks in `.agents/git-hooks/`
(`pre-commit`, `commit-msg`, `pre-push`) enforce it for agents and humans, enabled by `pnpm install`
(`prepare` script); the workspace's `.claude/hooks/guard-git.py` blocks pushes and commits to
`staging`/`main` and `--no-verify` for Claude Code.

Verify before committing: `pnpm verify` (types, ESLint, Prettier, tests, build), as CI does.

Branches: feature branch → pull request into `staging` (deploys staging) → pull request from `staging`
into `main` (deploys production). **Never push or commit to `staging` or `main`, never use `--no-verify`**:
the hooks refuse it, and a refusal means changing the approach, not getting around it.

## Safety

- Never read, print or copy `.dev.vars` or any secret. Secrets go in with `wrangler secret put`.
- Server-only code lives in `app/lib/.server/`; nothing there may be imported by client code.
- `AUTH_MODE=dev` is for the local database only; never set it on a deployed environment.
- Never deploy (`pnpm run deploy:*`) unless the user asks for that environment in the current request.
- Actions run against real data, even locally (the Drafft Local app uses the same database): test
  mutations on throwaway accounts only.

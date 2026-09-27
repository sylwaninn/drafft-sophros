# Instructions for AI agents

sophros: the drafft team's moderation and support dashboard. React Router 8 (framework mode) on
Cloudflare Workers, Tailwind 4. Everything it reads or changes goes through the `admin_*` functions of
the `drafft-backend` repository (migration `20260927000007_sophros.sql`): a new capability starts with a
function there, with its role check and its audit line, then a page here. See [README.md](README.md).

React Router and Workers APIs move fast: read `node_modules/react-router/docs/` and the skill in
`.agents/skills/react-router/` before changing routes, loaders, actions or middleware.

## Rules for every agent

- Commits and branches: [.agents/rules/commits.md](.agents/rules/commits.md) (scope `sophros`)
- GitHub: [.agents/rules/github.md](.agents/rules/github.md)
- Git hooks (`.agents/git-hooks/`: `pre-commit`, `commit-msg`, `pre-push`), enabled by `pnpm install`
  (`prepare` script; or by hand: `git config core.hooksPath .agents/git-hooks`)
- Claude Code: `.claude/hooks/guard-git.py` blocks pushes to `staging`/`main` and `--no-verify`

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

# Instructions for AI agents

sophros: the drafft team's moderation and support dashboard. React Router 8 (framework mode) on
Cloudflare Workers, Tailwind 4. Everything it reads or changes goes through the `admin_*` functions of
the `drafft-backend` repository (migration `20260927000007_sophros.sql`): a new capability starts with a
function there, with its role check and its audit line, then a page here. See [README.md](README.md).

React Router and Workers APIs move fast: read `node_modules/react-router/docs/` and the `react-router`
skill (`.claude/skills/react-router/`) before changing routes, loaders, actions or middleware.

## Working with the user

- **Rules live in this repository, never in an agent's memory.** A rule the user gives (design, copy,
  product, way of working) goes into the document it belongs to, in the same change: DESIGN.md,
  PRODUCT.md, this file, or WORDING.md (in drafft-ios, its source). Never save it to Claude Code's auto
  memory: a cloud session, another machine or another agent would never see it.
- **Who drafft is for stays in PRODUCT.md.** The audience (age above all, city, how often people train) is
  never written in a README or any other doc. A README never details what a session proposal holds.
- **Industry-grade solutions.** Every fix or feature takes the robust, secure, scalable solution the
  industry already uses (proven libraries and patterns: idempotency keys, retries with backoff,
  dead-letter queues and redrive, circuit breakers, stale-while-revalidate), never a quick patch.
  Challenge it before presenting it: name the pattern, its failure modes and how they are covered.
- **Design calls are yours.** On design and build tasks, decide the structure, the call to action and the
  wording (within WORDING.md) and say what you chose in the summary, instead of a round of questions.
  Lean modern: rich motion and micro-interactions.
- **Never check screens yourself**: no screenshots, no visual review by a subagent.
  Start the dev server and give the address, then hand over.
  The user checks the result themselves.
- **Always live**: revalidate after every action and when data goes stale; counters never wait for a
  reload.
- **Reviews run in depth, never trimmed.** A review (`/pr-review-toolkit:review-pr`, a pull request
  audit) uses every applicable specialist agent on each pull request (code-reviewer,
  silent-failure-hunter, pr-test-analyzer, comment-analyzer, type-design-analyzer, then code-simplifier).
  Batch by repository if needed; never drop an aspect to save agents.
- **Don't wait for CI or deploys.** Start the run, look at its status once if useful, report and move on.
  Never block on `gh run watch`.

## Repository rules

Everything an agent needs is in this repository: this file, the docs it links, and `.claude/` (settings,
git guard, skills). Claude Code loads the same files on this machine and on the web.

### Branches and commits

- Never commit on `main` and `staging`. Branch from a fresh `origin/staging` (`git fetch origin` first), named
  `feat/`, `fix/`, `chore/`, `docs/` or `hotfix/` + a short kebab-case name.
- Commit messages: `type(scope): description`, one line, no body, no trailers. Types: feat, fix, docs,
  style, refactor, test, chore. Scope (required): `sophros`. The description is lowercase,
  imperative, starts with a verb and has no final period. Example: `feat(sophros): add the photo review queue`.
- Commits are authored by the user only: never a `Co-Authored-By` or any AI attribution line
  (`.claude/settings.json` turns Claude Code's off; the `commit-msg` hook and CI refuse them).
- One logical change per commit; every commit passes verify. Never `--no-verify`.
- Enforcement: the git hooks in `.agents/git-hooks/` (`git config core.hooksPath .agents/git-hooks`,
  which `.claude/settings.json` runs at the start of every session) and, for Claude Code,
  `.claude/hooks/guard-git.py` (commits and pushes to `main` and `staging`, deleting them, `--no-verify`). If a hook
  refuses, change the approach; never work around it.

### Pull requests and releases

- Open them with the `create-pr` skill (`.claude/skills/create-pr/`), into `staging`. Title in
  conventional commit format, English, 70 characters at most (it becomes the squash commit and feeds
  the release version: `type!:` major, any `feat` minor, else patch). Every section of the body filled,
  no AI attribution. Squash-merge.
- Never merge a pull request whose checks are red or still running, never with admin rights.
- A merge into `staging` deploys sophros-staging (`ci.yml`). A release (Actions > release, started by hand on GitHub) fast-forwards `main` to `staging`, tags `vX.Y.Z`, and `ci.yml` deploys that tag to sophros-production.
- Agents never start a release or a deploy unless the user asks for it in the current request, and
  never tag by hand.

### Secrets

Never open, print, copy, search or summarize `.env*` files (`.env.example` is safe), `.dev.vars`
(`.dev.vars.example` is safe), keys, `google-services.json` or anything in `~/Secrets/`, by any means.
Run the CLI that consumes them without showing them, and only when the user asks: it writes to a remote
project. Never write, regenerate or overwrite a user's `.env.local`. `.claude/settings.json` denies the
reads.

### Environments

Apps an agent installs or launches always target the local Supabase. Never build, install, deploy or run
mutations against staging or production unless the user asks for that environment in the current
request. Compile-only checks are the exception.

### Work that spans repositories

A product feature usually runs backend, then the two apps (then the website for legal or marketing
copy): one session and one pull request per repository, backend first since the apps call its RPCs and
functions. Both apps ship it with the same names, behaviour and strings. The first
pull request states the contract (RPCs, payloads, event names) and the next ones link it. Another
repository is read on GitHub (`gh repo clone sylwaninn/<repo>` into a temporary folder), never edited
from here, except the shared docs below when the user agrees.

### Shared docs

This repository's `DESIGN.md` is its own, and it has no `WORDING.md`. When a change here calls for a change
to the apps' `WORDING.md` (drafft-ios, drafft-android, drafft-backend, drafft-web) or `DESIGN.md`
(drafft-ios, drafft-android), ask the user whether to make it; if yes, make the identical change in each,
one pull request per repository (`gh repo clone sylwaninn/<repo>` into a temporary folder, the `create-pr`
skill), linked to each other.

### This repository

Verify before committing: `pnpm verify` (types, ESLint, Prettier, tests, build), as CI does.

Branches: feature branch → pull request into `staging` (the default branch, deploys staging) → Actions >
release (`scripts/ci/release.sh`: staging's new commits onto `main`, a `vX.Y.Z` tag and a GitHub release,
then that tag deploys production). **Never push or commit to `staging` or `main`, never use `--no-verify`**:
the hooks refuse it, and a refusal means changing the approach, not getting around it.

## Safety

- Never read, print or copy `.dev.vars` or any secret. Secrets go in with `wrangler secret put`.
- Server-only code lives in `app/lib/.server/`; nothing there may be imported by client code.
- `AUTH_MODE=dev` is for the local database only; never set it on a deployed environment.
- Never deploy (`pnpm run deploy:*`) unless the user asks for that environment in the current request.
- Actions run against real data, even locally (the Drafft Local app uses the same database): test
  mutations on throwaway accounts only.

# Commit Rules

## Format (MANDATORY)

```
type(scope): description
```

- **ONE LINE ONLY** - Multiline commits are forbidden
- **Types**: feat, fix, docs, style, refactor, test, chore
- **Scope**: `sophros` for this repository
- **Description**: Lowercase, no period, imperative mood
- **Start with a verb**: add, fix, update, remove, configure, refactor, etc. Never a bare noun list

## Examples

```
feat(auth): add PIN verification flow
fix(ui): resolve button alignment issue
refactor(services): extract user profile logic
chore(deps): update dependency X to v5
docs(readme): add setup instructions
test(auth): add login service tests
style(components): apply consistent spacing
```

## Protected Branches (ABSOLUTE)

`staging` deploys staging and `main` deploys production. They only change through pull requests:

- **NEVER** push to `main` or `staging`, in any form (`git push origin main`, `HEAD:staging`, `+main`,
  `--force`, `--all`, `--mirror`, or a plain `git push` while on one of them)
- **NEVER** commit on `main` or `staging`: create a branch first (`git switch -c feat/<name>`)
- **NEVER** merge into them locally; merges happen on GitHub, once CI is green
- **NEVER** use `--no-verify` (commit or push), and never disable or edit the hooks to get past them
- Flow: feature branch → pull request into `staging` → pull request from `staging` into `main`

Enforced by the git hooks in `.agents/git-hooks/` (`pre-commit`, `commit-msg`, `pre-push`, enabled by
`pnpm install`) and, for Claude Code, by `.claude/hooks/guard-git.py`. If a hook refuses, change the
approach; don't work around it.

## Branch Naming

| Prefix    | Usage               |
| --------- | ------------------- |
| `feat/`   | New features        |
| `fix/`    | Bug fixes           |
| `chore/`  | Maintenance         |
| `hotfix/` | Production critical |

## Pre-commit Hooks (ABSOLUTE)

- **ALL** commits must pass `pnpm verify`
- **NEVER** use `--no-verify`
- **NEVER** bypass hooks for any reason
- If hooks fail → fix the issue, don't skip it

## Attribution

- **NEVER** add `Co-Authored-By` trailers to commits
- All commits must appear as authored solely by the user
- Do not add any attribution lines for Claude or any AI tool

## Commit Content

- One logical change per commit
- Atomic commits that build independently
- No WIP commits, and no commits at all on `main` or `staging`
- Never commit sensitive data (.env, credentials)

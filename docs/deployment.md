# Deployment

**With drafft-backend.** sophros calls the backend's `admin_*` functions by their named arguments. When a
change touches that contract, the backend ships first, then sophros right after, per environment; the pull
requests link each other.

## Set up an environment

Once per environment, `staging` first, then `production`:

1. **Access.** Zero Trust > Access > Applications > Self-hosted: `sophros-staging.getdrafft.com` (or
   `sophros.getdrafft.com`), a policy allowing only the team's emails or identity-provider group, with
   MFA. Copy the Application Audience (AUD) tag and the team domain into `ACCESS_AUD` and
   `ACCESS_TEAM_DOMAIN` of that environment in `wrangler.jsonc`. If the team domain changes, change the smoke
   test's argument in `.github/workflows/ci.yml` too (`scripts/ci/smoke.sh <url> <team domain>`).
2. **Staff**, in that environment's database (SQL editor): at least one admin, who adds the rest from the
   Staff page.
   ```sql
   insert into private.staff (email, role) values ('you@getdrafft.com', 'admin');
   ```
3. **Secrets**, typed in, never committed:
   ```sh
   pnpm exec wrangler secret put SUPABASE_SECRET_KEY --env staging   # an sb_secret_ key made for sophros
   pnpm exec wrangler secret put STREAM_API_KEY --env staging
   pnpm exec wrangler secret put STREAM_API_SECRET --env staging
   pnpm exec wrangler secret put MEDIA_SIGNING_KEY --env staging    # the backend's MEDIA_SIGNING_KEY for staging
   ```
   Give sophros its own secret key (Supabase > Settings > API keys) so it can be revoked alone.

`wrangler.jsonc` turns `workers_dev` and `preview_urls` off, so the Worker answers only on its custom domain,
behind Access.

## CI and releases

Deploys run from GitHub Actions (`.github/workflows/ci.yml`); the checks each run makes are in the README's
Deploy table.

| Ref                            | Deploys              | How it moves                                              |
| ------------------------------ | -------------------- | --------------------------------------------------------- |
| `staging` (the default branch) | `sophros-staging`    | merged pull requests                                      |
| `v*` tags                      | `sophros-production` | Actions > release: `main` fast-forwards to `staging`, tag |

The release (`.github/workflows/release.yml`, `scripts/ci/release.sh`) needs staging's head green, picks
the next `vX.Y.Z` from the released pull request titles (or the one asked for) and publishes a GitHub
release; it then starts `ci.yml` on the tag, which deploys it. A deploy then smoke-tests the domain: it must
redirect to Access, never answer without it. Actions are pinned to a commit and Dependabot proposes updates
weekly, into `staging`.

The repository needs the secret `CLOUDFLARE_API_TOKEN` (Cloudflare > My Profile > API Tokens > template
"Edit Cloudflare Workers", this account and the `getdrafft.com` zone) and the variable
`CLOUDFLARE_ACCOUNT_ID`.

### Roll back

Actions > ci > Run workflow on an older `v*` tag deploys that tag to production again.

## Emergency deploy

Only when GitHub Actions can't deploy, from a machine logged in with `wrangler login`:
`pnpm run deploy:staging`, or `pnpm run deploy:production` (asks to type `production`).

<!--
Title: type(scope): lowercase description, no final period. It becomes the squash commit on staging.
  types: feat, fix, docs, style, refactor, test, chore. `type!:` for a breaking change.
Base: staging. Never main (main only moves through the release workflow).
No AI attribution line in the description or in any commit (CI refuses it, scripts/ci/pr_check.sh).
Delete these comments and any section that doesn't apply.
-->

## Summary

<!-- What changes for the person using drafft, in two or three sentences. Then why. -->

## Changes

<!-- The main changes, one line each, with the types or files that carry them. -->

-

## Testing

<!-- What you ran and what you saw. Say what you did not run. -->

- [ ] `pnpm verify` (types, ESLint, Prettier, tests, build)
- [ ] Run on the dev server against staging, steps: 1.

## Screenshots

<!-- UI changes: before / after, light and dark, the longest language (FR, DE or NL) when a label moved. -->

## Notes

- **Telemetry:** <!-- Sentry errors and PostHog events added for sophros, flows the apps must track, or "none, because ..." -->
- **Wording:** <!-- text staff or users read, written with the wording skill (drafft-ios/WORDING.md), or "no text" -->
- **Privacy:** <!-- new personal data, third party or retention change (legal pages in drafft-web), or "none" -->
- **Companion pull requests:** <!-- the other drafft repositories, or "none" -->
- **Backend:** <!-- admin_* functions or migrations this relies on (drafft-backend pull request), or "none" -->
- **Breaking change:** <!-- what a client or the backend must do, or "none" -->

# Releasing

`mobxstate` uses Changesets for versioning, GitHub Actions for validation and release PR generation, GitHub Pages for the live site, and manual npm publish from a maintainer machine.

## Responsibilities

- `CI` validates every change on pull requests and pushes to `master`.
- `Release PR` creates or updates the Changesets version bump PR after changes land on `master`.
- `Deploy Pages` rebuilds and deploys the live site to `gh-pages` after pushes to `master`.
- npm publish is manual. A maintainer confirms the release locally with `npm login` and OTP / 2FA if npm requires it.

## Who Can Publish

Maintainers with npm publish access to the `mobxstate` package.

## Contributor Flow

1. Add a changeset in any PR that changes the published package:

```bash
npm run changeset
```

If a PR changes repo tooling or docs only and should not publish a new package version, record that explicitly:

```bash
npm run changeset -- --empty
```

2. Merge the feature PR into `master`.

3. GitHub creates or updates the release PR with version and changelog changes.

4. Review and merge the release PR.

5. Publish locally from a clean checkout of `master`.

## Maintainer Commands

From a clean checkout of `master`:

```bash
git checkout master
git pull
npm run release:login
npm run release:ship
git push --follow-tags
```

If npm asks for an OTP explicitly:

```bash
npm run release:publish -- --otp=123456
npm run release:ship -- --otp=123456
```

## Release Scripts

- `npm run release:login` runs `npm login`.
- `npm run release:whoami` confirms the active npm account.
- `npm run release:status` runs `changeset status --verbose`.
- `npm run release:version` runs `changeset version` and requires a clean git tree.
- `npm run release:check` runs lint, typecheck, test, library build, Pages build, package pack, and package smoke test.
- `npm run release:publish` requires a clean git tree, prints the npm username, rebuilds the package, and runs `changeset publish`.
- `npm run release:ship` requires a clean git tree, runs `npm ci`, then `release:check`, then `release:publish`.

Do not use per-package publish commands as the normal flow. Publish through Changesets so versioning and changelogs stay coherent.

## GitHub Workflows

- `.github/workflows/ci.yml` validates source, packages, and the Pages build.
- `.github/workflows/release-pr.yml` creates or updates the release PR. It does not publish to npm.
- `.github/workflows/deploy-pages.yml` publishes the static live site to `gh-pages`.

## Common Failure Modes

### `npm whoami` fails

Your npm session is missing or expired.

Run:

```bash
npm run release:login
npm run release:whoami
```

### Release PR exists but publish does nothing

Usually one of these is true:

- the release PR is not merged yet
- there are no unpublished versions left to publish

Check:

```bash
npm run release:status
```

### `release:status` says packages changed but no changesets were found

This means the branch contains publishable package changes without a changeset file.

Fix it with one of these commands:

```bash
npm run changeset
npm run changeset -- --empty
```

### Pages deploy fails

Usually one of these is true:

- GitHub Pages is not enabled for the repository
- the Pages source is not set to `gh-pages`
- the site build output is wrong or empty

Check the `Deploy Pages` workflow and the `dist-pages` build output locally:

```bash
npm run pages:build
```

### `changeset version` or `release:publish` refuses to run

These commands require a clean git working tree. Commit or stash local changes first.

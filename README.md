# Browser

Browser shows web pages as documents in the window of a Noldova desktop app, and lets the app's agents drive them with the person's approval.
It is a module for apps built on [Noldova Desktop](https://github.com/noldova-com/desktop), shipped as the npm package `@noldova/browser` with its window part and protocol packages.
An app of its own, built on Noldova Desktop, is planned, as [documents/ARCHITECTURE.md](documents/ARCHITECTURE.md) says.
The module is product-neutral: an app configures it through its published API, and the module holds no app's names, text or behavior.

Each action an agent takes on a page is judged by its risk, and one above low raises a permission request, which the app's policy decides whether to ask the person; [documents/SECURITY-MODEL.md](documents/SECURITY-MODEL.md) says what a page's text can't make an agent do.

It targets Windows, macOS and Linux on x64 and ARM64.
Every package is below 1.0 for now, and its API may change from one version to the next.
To report a bug or ask for a change, open an issue in this repository, as the organization's [contributing guide](https://github.com/noldova-com/.github/blob/main/CONTRIBUTING.md) says.
Report a security problem privately, as its [security policy](https://github.com/noldova-com/.github/blob/main/SECURITY.md) says.

## Getting started

An app installs the module's package, pinned exactly, and adds the module as its desktop base's module contract says:

```bash
npm install --save-exact @noldova/browser
```

[documents/ARCHITECTURE.md](documents/ARCHITECTURE.md) says how the module is built, what an app configures through its published API, and what it needs from the desktop base.

| Package | What it is |
|---|---|
| `@noldova/browser` | The module: its `module.json`, `settings.json`, `menus.json` and `webViews.json`, and its runtime part, which runs the agent tools. |
| `@noldova/browser.window` | The window part: the browser pane and its page documents, in Angular. |
| `@noldova/browser.protocol` | The names and messages the runtime and window parts share. |

## Building from source

```bash
npm ci
npm run build
npm test
```

`npm ci` installs the exact versions the root's lockfile records for the whole repository, the window part's Angular project included, since the root's `package.json` declares every package, and the packages under `src` aren't workspaces; `npm run build` installs them with install scripts off when `node_modules` is missing.
`npm run build` builds and packs the three packages into `_packages`, and installs the protocol and window packages in the root.
`npm test` runs every check against those, the last of which installs the three packages into a fixture app, so it runs after the build.
[documents/TESTING.md](documents/TESTING.md) says what the checks cover and on which targets.

## Checks

Every pull request into `main` must pass "Check / Linked issue" and "Build and test / All targets", which [documents/TESTING.md](documents/TESTING.md#the-pull-request-checks) describes.

`.github/workflows/module-range.yml` calls Noldova Desktop's "Module range" workflow, pinned to Noldova Desktop 0.0.1's commit, with `src/noldova.browser`, on every pull request, every night and by hand.
It builds and tests the module, with `npm run peers:newest && npm run build` and `npm test`, against the newest published Noldova Desktop inside `module.json`'s `noldovaDesktop` range, which `@noldova/desktop.build`'s range check chooses, at the Noldova Desktop version the root `package.json` pins.
`npm run peers:newest`, `scripts/move-peers.ts`, installs at the root, without saving it, the newest published version of each `@noldova/context.` package inside the packages' peer ranges, and that same version of each other `@noldova/context.` package the root `package.json` pins, since the context packages are released together at one version; the install names the version `node_modules` holds of each other `@noldova/` package the root pins, so the Noldova Desktop version the run moved to stays, and it checks that `node_modules` holds each moved version, so the newest context inside the range is tested every night too.
A failing nightly run opens or updates an issue, so the job holds only `contents: read` and `issues: write`.
The build's install of the packed packages names the version `node_modules` holds of each `@noldova/` package the root `package.json` pins, since an install otherwise takes the lockfile's version back, so the versions that run moved are kept.

### Tests that need the foreground focus

These end-to-end tests need the operating system's foreground focus, so they run last, one at a time, as [documents/TESTING.md](documents/TESTING.md#serial-tests) says:
- `e2e/specs/focus.spec.ts`
- `e2e/specs/keys.spec.ts`
- `e2e/specs/agent-input-focus.spec.ts`

### Coverage

`npm test` fails below 100% of the statements, lines, branches and functions of the production code under `src`, without these exclusions, each granted here with its reason:

| Excluded | Where | Reason |
|---|---|---|
| `**/tests/**` | The root's `vitest.config.ts` | The tests themselves, not production code. |
| `src/*.window/**` | The root's `vitest.config.ts` | The window part's specs measure it through Angular's unit-test builder, to the same 100%; the root's suite doesn't run them. |
| `src/**/*.d.ts` | `src/noldova.browser.window/angular.json` | The window part's hand-written declarations of its API, which hold no code to run. |
| The compiler's development-mode class-metadata calls | `scripts/angular/class-metadata-coverage.ts`, which `src/noldova.browser.window/vitest.config.ts` adds | Code Angular's compiler adds, which runs only in development mode; the plugin marks the calls and reports how many it left out. |

### Fixed pauses

No test waits a fixed time.
Two specs wait for an animation frame, on purpose:

| File | Pause | Why |
|---|---|---|
| `src/noldova.browser.window/tests/app/components/pane-toolbar/pane-toolbar.component.spec.ts` | One animation frame, in the test that draws an http page's "Not secure" at its width from the first frame | Its claim is what the first frame draws, so a wait on the condition would hide the bug it exists for. |
| `src/noldova.browser.window/tests/protocol/models/page-change-script.spec.ts` | One animation frame, requested after the script's, where a test checks that the script reported nothing | The script reports at most once a frame, from its own animation frame callback, and the browser runs a frame's callbacks in the order they were requested, so the test's frame is the definite signal that the script's frame has passed. |

### Test files over 1 second

A unit test file finishes in under 1 second and a component spec file's median test in under 100 milliseconds, as `npm run test:timing` checks, from the median of three runs on a quiet test machine; `npm test` only reports the files over 1 second.
A maintainer accepts a unit test file over 1 second, or a component spec file over a 100 millisecond median test, here, with its time and why, and each component test over 1 second is listed with its cause.
No unit test file is accepted; these component tests take over 1 second:

| Test file | Time | Why |
|---|---|---|
| `src/noldova.browser.window/tests/app/components/pane-toolbar/pane-toolbar.component.spec.ts` | 1.1 to 1.3 s each, for its three tests that draw the address once in every state of the field, in the Light, Dark and forced colours looks | Each takes a screenshot of the address field in each of about ten states and reads its pixels, since its claim is what the screen shows, which no layout box tells. |

These component spec files are accepted over a 100 millisecond median test:

| Spec file | Median test | Why |
|---|---|---|
| `src/noldova.browser.window/tests/app/components/page/page.component.spec.ts` | 116 to 170 ms on Linux, macOS and Windows | Accepted by the Owner on 2026-11-14: each test mounts the whole page, with the UI kit's components, in the browser, and measures it once it settles |
| `src/noldova.browser.window/tests/app/components/pane-toolbar/pane-toolbar.component.spec.ts` | 118 to 183 ms on Linux, macOS and Windows | Accepted by the Owner on 2026-11-14: each test mounts the toolbar with the UI kit's components in the browser, and three of them draw the address in every state of the field, in every look |

### Flake proof

The "Flake proof" workflow, `.github/workflows/flake-proof.yml`, calls the organization's shared flake proof, v2.51.1, which the `.github` repository's README describes under "Proving flakes"; it runs `npm test`, or another npm script it is given, many times over on the same runners, to prove a flaky test fixed or to hunt one.
A member starts it by hand, with the ref, the filter, the script, the npm scripts each job runs once after the build and before the runs, whether each run on Linux runs under a virtual display and a session bus, the number of runs and parallel jobs, and the targets, such as `linux-x64 windows-x64`.
With `reports`, such as `_build/e2e` for `test:e2e`, each run's report and results go into the job's artifact, kept 3 days, so a failed end-to-end run keeps its Playwright trace; a passed run keeps none, as Playwright drops its trace.
A flaky test's fix is proven by 10 runs of its test file alone, through the filter, which each run passes to `npm test` as test files from the repository root with forward slashes:

```bash
gh workflow run flake-proof.yml --ref <branch> -f filter=src/noldova.browser/tests/services/page-changes.test.ts -f runs=10 -f "targets=linux-x64 windows-x64 macos-arm64"
```

A file under `src/noldova.browser.window/` runs in the window's Angular test run, and any other in the root's; a filtered run measures no coverage, so it is never the gate.
The proof's concurrency group is named by the ref and the first 16 hex digits of the SHA-256 of `script`, `prepare`, `display` and `filter`, which a first job, "Concurrency group", works out, so proofs that differ in any of them run side by side, and a second proof of the same ref and the same four waits until the first ends.

## Releases

The pull request that changes the version writes that version's section in [CHANGELOG.md](CHANGELOG.md) from the pull requests merged since the previous version, and no other pull request edits the file.

The module's packages, `@noldova/browser`, `@noldova/browser.protocol` and `@noldova/browser.window`, are published together at one version to npm, by the Release workflow, `.github/workflows/release-npm.yml`, and a release never deletes a published version.
It publishes through npm's trusted publishing, with provenance, so no token is stored: each package's trusted publisher on npm is this repository's `release-npm.yml` in the `release` environment.

- **It starts by hand only,** with two inputs: the version, `major.minor.patch` with no prerelease suffix, and the full hash of the commit on `main` to release.
- **The version is the root `version.json`'s** at that commit, which the build stamps on every package.
  The build refuses to run when the root `package.json` holds another version, so a version pull request changes both.
- **It calls the organization's shared npm release workflow,** `release-npm.yml` in `noldova-com/.github`, pinned to v2.51.1's commit, whose README says what each job does and with which permissions, in the `release` environment, which holds the publish approval.
- **After the release, its dependents job** calls the organization's shared `update-dependents.yml`, v2.51.1, with the version and the commit, which proposes the version to the repositories that pin the module, as the shared workflow's README says.

The shared workflow checks that the commit is on `main` and that its `version.json` holds the version, and tags the commit `v<version>` first, so a workflow change merged while the release waits for its approval can't leave the version untagged.
Then it runs `npm ci` and `npm run build` on a clean checkout of it, and checks the archives in `_packages` before the approval.
Its check wants exactly the archive of each package under `src/` at the version, in the scope and not private, each holding a `LICENSE`, a `license` field and the commit as its `gitHead`.
On the approval it publishes them, with npm's provenance.
A version whose build or publish fails keeps its tag, and a release of the same version at the same commit can still publish it.

`npm run build` also checks that each archive holds every file its build copies in, the repository's `LICENSE`, the package folder's `README.md` and the package's declarations, byte for byte, and fails on any difference.
Each package's `README.md` is the page npm shows for it, so its links are absolute, to this repository on GitHub; the build refuses a package folder without one.
`npm run build --silent -- --list-copies` builds nothing and lists those copies, one line for each, with the source's path from the repository's root, the package's name and the path inside the package, separated by tabs, then `end of copies`; the shared workflow's archive check asks for that list.

A failed release runs again whole, as a new run, which builds and checks the archives again.

| File | What it does |
|---|---|
| `.github/workflows/release-npm.yml` | Calls the shared workflow in the `release` environment, then the shared `update-dependents.yml`, which proposes the version to the repositories that pin the module. |
| `version.json` | The version the release publishes. |
| `scripts/build.ts`, run as `npm run build` | Builds the archives into `_packages`: it stamps `version.json`'s version, copies in the `LICENSE` and each package's `README.md`, records the commit of a clean checkout as each archive's `gitHead`, and compares each archive with the files it copied in. |

## License

Browser is licensed under the [MIT License](LICENSE).
Its third-party packages keep their own licenses, which their packages carry.

Angular, Chromium, GitHub, Linux, macOS, npm, Playwright, Vitest, Windows and the other product names used here are names of their owners.

## Trademarks

The code is under the MIT License, while the name "Noldova" and its logo are not: the MIT License grants no right to them.
A build from this code that is published by anyone but Noldova uses another name and its own logo.

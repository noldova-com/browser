# Testing

**Scope:** What the pull request checks verify in this repository, the targets and test layers of the module, the test doubles of the desktop base's contracts, and the testing rules this repository adds to the organization's standard.

The organization's testing standard, `https://github.com/noldova-com/.github/blob/main/standards/TESTING.md`, applies here in full.
The checks run on GitHub-hosted runners.

## The pull request checks

Every pull request into `main` must pass both checks before it merges.

| Check | What it verifies |
|---|---|
| Check / Linked issue | The organization's shared check, which `.github/workflows/require-linked-issue.yml` calls from its `check` job, named "Check": the PR description names an issue in this repository. |
| Build and test / All targets | Every target's job passed. |

`.github/workflows/build-and-test.yml` calls the organization's shared `build-and-test.yml`, v2.34.0, with `publishes: true`, as the `.github` repository's README describes it.
Each target's job builds, checks the toolchain, Node.js 26.13.1 with npm 11.20.0, and the line endings, `* text=auto eol=lf` in `.gitattributes` and LF only with exactly one final newline in every tracked text file, with the shared pipelines tool, then runs `npm run test -- --skip-test-details --skip-coverage-details` and checks that the build and the tests changed no tracked file, within 20 minutes.
On Linux x64 it also builds a second time in a clean worktree and checks that the archives are the same, byte for byte, and on every target it checks the archives as the release does, with `pipelines archive`: each archive's name, version, `gitHead`, scope and licence, and a byte-for-byte copy of every file `npm run build --silent -- --list-copies` lists, at its path.
`npm run build` first installs the dependencies with `npm ci --ignore-scripts` in the root, only when its `node_modules` is missing; the root's `package.json` declares every package the build and tests use, [the Angular project](#the-angular-project)'s included, and the packages under `src` aren't npm workspaces; it then builds and packs the module's three packages and checks the archives with `scripts/services/archive-check.ts`, which, beyond the shared check, refuses a module archive without `module.json`, a caret range on the kit, a Noldova Desktop peer at another range than `noldovaDesktop`, a range among the dependencies or the optional dependencies, an Angular peer of the window part's package that is exact or ends short of the next major, a range on Angular in the module's package, and a `module.json` that isn't JSON or names no `noldovaDesktop`.
`--skip-test-details` gives the root suite Vitest's dot reporter, and `--skip-coverage-details` leaves fully covered files out of its coverage table; `npm test` refuses any other option.
A full `npm test` ends by installing the packed packages from `_packages` into a fixture app with install scripts off, with `scripts/tests/installed-package/install-and-activate.ts`, so it runs after `npm run build`.
The fixture app also installs, packed from the repository's own install, Noldova Desktop's runtime, protocol and window packages, the module package's peers, the five packages they depend on, the UI kit, the Angular packages and rxjs and tslib that the window's declarations reach, and Node.js's types.
The check, `scripts/tests/installed-package/activate-browser.ts`, is copied there with the scripts' files it imports and `window-declarations.ts`, which re-exports every type of `@noldova/browser.window` and of the module's `./window`.
Both are compiled first against the installed packages' declarations with every library file checked, so a declaration of any of the three packages that differs from what it imports, or doesn't compile, fails it; the repository's own type-check of `scripts` leaves it out, since the module package isn't installed in the repository.
It checks that the module package holds `module.json`, `settings.json` and `webViews.json` and resolves both parts, and activates the installed runtime part on Noldova Desktop's `FakeRuntimePartContext`, over an in-memory database its own migrations built, then reports a view opening.
It then types an address in that view's workspace through `browser.allowTypedAddress`, and checks that the part gave the view its origins, kept the typed origin in its database, and let go of Noldova Desktop's events and agent sessions when it deactivated.
Every package comes from npmjs, so the build needs no token; the repository's `.npmrc` only sets `save-exact`.
`npm run build` first fails when `npm ls @angular/cdk --all` in the root lists more than one copy, naming each copy's version and path, or none, with `scripts/checks/cdk-copy-check.ts`; a second copy, which npm nests under the UI kit without a warning when the window part pins another version, would run the kit's overlays and focus handling apart from the window part's.
It then compiles each package alone against what is installed, packing each into `_packages`: the protocol with the TypeScript compiler into `_build/browser`, then the window part with Angular's compiler in partial compilation mode, which an app's own Angular compiler links, in a work folder under `_build/angular`, so the build writes nothing outside the repository, then the runtime part with the TypeScript compiler into `_build/browser`.
After packing the protocol and again after packing the window part, it installs the archives packed so far into the root's `node_modules` with `npm install --no-save --ignore-scripts --no-audit --no-fund`, so the parts after them and the tests import the packed packages, never their sources; the module's own archive isn't installed in the root, which has the module's name.
The same install names the version `node_modules` holds of each `@noldova/` package the root `package.json` pins, so a version the Module range run moved stays installed rather than going back to the lockfile's.
`npm test` runs `scripts/test.ts`, which stops at the first step that fails.
It first refuses any fixed pause in a test file, as [Fixed pauses and coverage exclusions](#fixed-pauses-and-coverage-exclusions) says, with `scripts/checks/pause-check.ts`.
Then `scripts/checks/on-push-check.ts` reads the `.ts` and `.mts` files under `src/` that Git tracks or would track, as `git ls-files --cached --others --exclude-standard -- src` lists them, so a copy without a commit is read too, and fails on any `changeDetection` key whose value isn't `ChangeDetectionStrategy.Eager`, naming its file and line, as ui-components' own check does: OnPush is every component's default since Angular 22, so a component leaves the strategy out, and writes one only to choose Eager, with the reason.
Then the declaration check, `scripts/declarations/declaration-check.ts`, fails on any problem in the repository's own `module.json` and the manifests: the declaration's fields and names, each part exported by the module package as `./<part>` to a file it holds, with the tools' names as Noldova Desktop takes them, snake_case after `browser_`, that its `dependencies` is an object from module ids to exact versions, the package's name and version, that every dependency is pinned exactly, that `noldovaDesktop` runs from a version to the next minor below 1.0, or the next major from 1.0, that the package's peers on Noldova Desktop's packages name it, its other peers an exact version or, on context's and the kit's packages, a range of the same form, and that the root's and the window project's Noldova Desktop pins are inside it.
The API declaration check, `scripts/checks/api-declaration-check.ts` with `scripts/api`, ported from Noldova Desktop's through Terminal's, compares each package's exported surface with its `src/api/*.d.ts`, member by member, for the protocol, the window package, and the module package's `./runtime` and `./window` parts, and fails on a member the code has and the declarations miss, or the other way, and on the declarations' own compile errors.
The example check, `scripts/checks/api-example-check.ts`, compiles the code of every `@example` in those declarations against them, in memory, and fails on each compile error, with its file and line.
It then type-checks the automation under `scripts` and the package's sources and tests with the TypeScript compiler, and runs every `*.test.ts` file under the packages' `tests` folders with Vitest in Node.js, against Noldova Desktop's own tool registry and the [doubles](#test-doubles) of its other contracts.
A whole run also writes the root suite's Vitest JSON report to `_build/test-times.json`, and `scripts/checks/test-time-check.ts` names each test file that took over 1 second in that run and whether README.md accepts it; it only reports, and never fails the run, since one run's time depends on how busy the machine is.
Then, in `src/noldova.browser.window`, with the root's own Angular compiler, Playwright and Angular CLI: `ngc` type-checks the part, Playwright installs its headless Chromium shell, Angular's unit-test builder, `ng test`, runs every `*.spec.ts` under `window/tests` with Vitest in headless Chromium, against a fake window context, and the look target, `ng run window:test-look`, runs the `*.look.ts` files the same way at a 1280 by 800 viewport, without coverage.
A whole run includes the look target, which saves a screenshot of each page state in both themes for review; the screenshots are evidence and assert nothing, and the page's geometry is asserted in the window's specs.
Last it runs the installed-package test above.
The root suite's Vitest keeps its cache in `_build/vite`, the window part's Vite its pre-bundled dependencies in `_build/window/vite`, and Angular its build cache in `_build/window/angular-cache`, so a second run reuses each; none is wiped before a run, and the window's attachments and coverage go to `_build/window/attachments` and `_build/window-coverage`.
Each window run prints Vite's warning that a dynamic import in Vitest's pre-bundled module runner "cannot be analyzed by Vite": Vite 8.3.5 skips that warning only for importers under `node_modules`, and the pre-bundles sit in `_build` on purpose, so the warning is expected and harmless.
`scripts/test.ts` runs the window part without `CHROME_BIN`, which Angular's unit-test builder would pass to Playwright as the browser to launch, and which the image of CI's Linux x64 runner sets to its own Google Chrome.
So every run launches the Chromium headless shell that `playwright install` puts in place for the pinned Playwright.
On CI, where `CI` is set and `DEBUG` isn't, `scripts/test.ts` gives the window part `DEBUG=vitest:browser:pool,vitest:browser:playwright,vitest:browser:api`, so its log says, each line with a timestamp, when Vitest creates each browser session, launches Chromium, opens the session's page, and hears from it first, and a session that doesn't connect within Vitest's 60 s shows which phase was slow; the pool's lines also name each test file as it starts and ends.
A run fails when a package's sources fall below 100% line, branch, function or statement coverage.
The automation under `scripts` has no tests of its own, as the organization decided for every repository: its checks run, and nothing measures it.
Arguments make a filtered run, as `npm test -- <test file>` does: a window spec, named from the repository root, runs alone in the window part after its type-check and the browser install, a look file (`*.look.ts`) with the look target and any other with `ng test` without coverage, and any other argument filters the root suite, with the coverage gates off, since only the whole suite can meet them; a filtered run is not the gate.

`npm run test:timing`, `scripts/timing/timing-check.ts`, is the timing check, apart from `npm test` and run on a quiet test machine after `npm run build`.
It runs the root's test files and the window part's specs three times each, and takes each file's time, and each spec's tests' times, as the median of the three runs, so one run slowed by a busy machine doesn't decide it.
It fails on a unit test file over 1 second that README.md doesn't accept, or a spec file whose median test is over 100 milliseconds that README.md doesn't accept, each only past its bar plus 20%, for the jitter a quiet machine still has, and it names each component test over 1 second, which README.md lists with its cause.

The shared workflow's own steps run locally after `npm run build`, with the pipelines tool v2.34.0 pins installed from npmjs into a folder outside the copy, such as `npm install --prefix ../pipelines-tool --registry https://registry.npmjs.org/ --no-audit --no-fund @noldova/tools.pipelines.github@0.0.21`, then, from the repository root:

```bash
../pipelines-tool/node_modules/.bin/pipelines toolchain 26.13.1 11.20.0
../pipelines-tool/node_modules/.bin/pipelines line-endings
../pipelines-tool/node_modules/.bin/pipelines unchanged
../pipelines-tool/node_modules/.bin/pipelines reproducible _packages
../pipelines-tool/node_modules/.bin/pipelines archive _packages "$(node -p 'require("./version.json").version')" "$(git rev-parse HEAD)" @noldova
```

`line-endings` and `unchanged` read the files Git tracks, so they run in a clone, and `unchanged` after `npm test`; CI runs `reproducible` on Linux x64 only, and `archive` with the scope it publishes to.

### The Angular project

The window package works on the page's elements and holds the page document's Angular components, so its tests run in the Angular project in `src/noldova.browser.window/`, as Noldova Desktop's and the UI kit's do.
- The root's `package.json` declares, and its one install puts in the root's `node_modules`, Angular, its compiler and its CLI, the UI kit `@noldova/ui.components.angular` with the context packages it takes as peers, and TypeScript 6.0, which the Angular compiler and the scripts share; `src/noldova.browser.window/package.json` lists the window package's own runtime pins, and context's packages as peers at `>=0.0.7 <0.1.0`, the floor the packed window's peers keep.
- `src/noldova.browser.window/angular.json`'s test target runs the window package's tests with the CLI's unit-test builder and Vitest, in headless Chromium, with 100% line, branch, function and statement coverage of the package's sources.
- Its specs are named `.spec.ts`, as Angular's are, and mirror the sources' paths under `tests/`, except the protocol's page scripts, `PageChangeScript` and `ElementFactsScript`, which need a real page, so their specs run here, under `tests/protocol/models/`, while the protocol's other tests run in Node.js; the test target's providers file, `tests/test-providers.ts`, installs the UI kit's test providers, whose error handler throws, so an unexpected framework error fails the run.
- Its setup files, `tests/kit-stylesheet.setup.ts` and `tests/browser-matchers.setup.ts`, load the UI kit's stylesheet, which the test target's build carries, and the kit's matchers, so a component's specs see the kit's real styles and layout.
- Specs read Chromium's own accessibility tree through the DevTools protocol with `tests/fixtures/accessibility-tree.fixture.ts`, a line per node with its role, name, description and states, and wait for what the kit's live region speaks with `tests/fixtures/live-region.fixture.ts`.
- `tests/fixtures/emulated-media.fixture.ts` emulates forced colors and reduced motion through the same protocol, `tests/fixtures/zoom.fixture.ts` emulates 200% zoom there as twice the device pixels per CSS pixel, and `tests/fixtures/contrast.fixture.ts` measures contrast with each color composited over the backgrounds under it, so the page's colors are checked in Light and Dark and its cues under forced colors.
- The specs load the protocol package as `npm run build` installed it from its archive; `src/noldova.browser.window/vitest.config.ts` sets `server.fs.allow` to the repository root, so Vite serves the root's `node_modules` and its pre-bundles in `_build/window/vite`, both outside the window folder.
- `src/noldova.browser.window/vitest.config.ts` adds `scripts/angular/class-metadata-coverage.ts`, which leaves out of coverage the class-metadata calls the Angular compiler writes, which run only in development mode, and says how many it left out.
- A new package's tests run in Node.js unless the test target's `include` names them, which also makes it an Angular package.

"Build and test / All targets" also runs on every push to `main`.
To run every target on a branch without a pull request, a maintainer starts Build and test by hand on it, from the repository's Actions tab or with `gh workflow run build-and-test.yml -R noldova-com/browser --ref <branch>`; that run tests the branch as it is, not merged into `main`, so it never stands in for the required check.

## Targets

Every pull request into `main`, draft or ready, runs every test on Linux x64, Windows x64 and macOS arm64, and every push to `main` and every run started by hand on all six targets, Linux arm64, Windows arm64 and macOS x64 too, each on the GitHub-hosted runner that the organization's shared `versions.yml` names for it.
Pull requests skip the other three, which keeps their runners free.
The workflow's one job, `build-and-test`, named "Build and test", calls the shared workflow, which runs one job per target, named for its target, such as "Linux x64", which GitHub lists as "Build and test / Linux x64", and its "All targets" fails unless every one of them passed.

The [end-to-end workflows](#end-to-end-workflows) run in a job of their own, "Build and test / End-to-end test", on Linux x64 under a virtual display, which the shared workflow runs with `npm run test:e2e:prepare` and then `npm run test:e2e`, and whose report, `_build/e2e`, it keeps when they fail.

**Not yet:** the end-to-end workflows on the other targets, and a nightly run that repeats the tests, each come in their own pull request.

## Test layers

| Layer | What it drives | What it proves | What it doesn't prove |
|---|---|---|---|
| Unit tests | Each package through its public API, against the [doubles](#test-doubles) | The module's own logic: the tools, the page's states, its record and its restore, the origin list it hands over, the permission requests and every answer to them, and its handling of refusals, time and size limits, crashes and cleared profiles | That the base enforces anything, or that a real page behaves as the doubles do |
| Registry contract tests | The tool descriptors and handlers the module publishes, through Desktop's `FakeToolsContext` answered by Noldova Desktop's own `ToolRegistry` | The tool list and input schemas, which the registry checks, each tool's output and errors, the size limits, that each tool asks through the permission contract before it acts, and cancellation and session end | That the app's MCP server carries the calls as the registry hands them over |
| Contract suites | The same suite against a double and against the real base | That the double behaves as the real contract does, for every case the suite holds | Anything the suite doesn't hold |
| End-to-end workflows | The real app, with real views, through the [fixture host app](#the-fixture-host-app) | Isolation, the guards, the refused origins and schemes, the default denials, the tools on real pages, the page's placement, keys and focus within the run's display | A display at another scale, the operating system's foreground focus, and the packaged and signed binary; the [checks on a real desktop](#checks-on-a-real-desktop) cover those |

### Unit tests

- Every tool is tested for an allowed action, an origin refused by the base, each permission answer (granted once, always allowed, denied, always denied, expired and withdrawn), a crashed view, a cleared profile, a request over its time limit and a result over its size limit.
  `tests/tools/browser-tools.test.ts` runs each built tool through that list, and each action on both sides of its point of no return, with the failures mapped as the tool host maps them; each tool's own file holds its allowed actions, refusals and limits.
- Expiry runs on a scoped mock clock, as the organization's standard allows; real time limits are checked in the end-to-end workflows.
- A settle that waits a `setImmediate` turn drains the whole microtask queue first, so it never depends on how many awaits the code takes; no test steps with `await Promise.resolve()`.
- No tool sends a call that the base keeps off its agent-control allow list.
  The fake relay refuses every call that the module's `webViews.json` doesn't allow, with Noldova Desktop's own `WebViewDeclaration`, as the base does, and a test drives every tool with each kind of input and asserts that none of the calls the security model's [call table](SECURITY-MODEL.md#calls-on-the-view) refuses was sent.

### Registry contract tests

The module runs no MCP server.
It publishes its tool descriptors and handlers into the base's runtime tool registry, and the app hosts the one MCP server.

- **The tool list:** the registered tools and their input schemas equal the expected values written in the test, independent of the module's own definitions.
- **Each tool:** its output for valid input, its error for each invalid input, and its error when a result goes over its size limit.
- **Permission first:** every call of a tool that may change the page raises exactly one request through the permission contract before it acts, and does nothing on the page until the answer is granted.
  A read-only tool whose maximum risk is Low raises none; the tool matrix sends calls through Noldova Desktop's own permission center, whose checker refuses any request from such a tool, and covers every tool the module builds.
  A low-risk call's request says not to ask the person (`ask` false), and a medium or high one says to ask.
  Every answer path is tested: granted once, always allowed, denied, always denied, expired, withdrawn and a remembered answer that was revoked.
- **References:** a reference from an earlier snapshot, from before a navigation or whose element left the page ends the call as `Refused` with the module code `browser.staleReference`, with a message that says to take a new snapshot, and raises no request; one no snapshot of the session gave ends it as `Refused` with `browser.unknownReference`.
- **Changed after the grant:** a call whose page changed after its request was granted, so the page no longer matches what the request showed, ends with `Stale`, and the scripted views received no state-changing call.
  So does a click, typing or key whose element turned secret, or whose form gained a secret field, while its medium-risk card waited.
- **Changed during a snapshot:** a page that goes to another document during the snapshot function's read is read once more and its content carries the new document's origin and references; one that goes again during the second read ends with `Stale`, with no content and no reference.
- **Cancellation and session end:** a cancelled call stops its handler, ends its pending view requests with an error and withdraws its pending permission request.
  Any abort during the permission wait, a cancel, a session end, a stop, a time limit or a switch-off, ends the call with `Withdrawn` alone, and a cancel at any other point before the point of no return ends it with `Cancelled`, for every tool.
  The end of the agent's session does the same for every call of that session, and the registry refuses later calls from it.
  Outside the permission wait, the person's stop ends a call with `Stopped`, and the module's switch-off with `Unavailable`, before the point of no return.
- **Interrupted actions:** the architecture's [Errors and interrupted actions](ARCHITECTURE.md#errors-and-interrupted-actions) owns the shared reasons, the module codes and the rule for a non-resumable tool, which the [tools table](ARCHITECTURE.md#tools) marks.
  Each non-resumable tool is tested on both sides of its point of no return, its first `DOM.focus`, `DOM.scrollIntoViewIfNeeded` or `Input` call, or the bridge's navigate, for a time limit, a cancel, a stop, a session end and a switch-off.
  Before the point, while it classifies, waits for permission or reads nodes, it ends as any call would, with `TimedOut`, `Withdrawn`, `Cancelled`, `Stopped` or `Unavailable`, and the scripted views received no state-changing call.
  After it, each of those, a relay failure and a stale reference all end it with `OutcomeUncertain`, with no module code, and its message names the reason it ended with.
  The tool bench records that the tool marked the point once, just before that call.
  A read-only tool, after a time limit or a cancel at any of its calls, never ends with `OutcomeUncertain`.
  Every shared reason and every module code has at least one test that asserts it, and a check fails when one has none.

### Refusals, results and failures

The security model's [Refused even with permission](SECURITY-MODEL.md#refused-even-with-permission), [Results and logs](SECURITY-MODEL.md#results-and-logs) and [Failing closed](SECURITY-MODEL.md#failing-closed) sections own these rules.
The registry contract tests have one test for each bullet of those sections, titled with the section's name and the bullet's opening words.
A check fails when a bullet has no test, or a test names none.
These tests prove, for example, that:
- another session's view, element reference or console cursor is refused;
- an input over its limit fails before any relay call;
- no tool argument, page content or agent output changes the allowed origins;
- page content comes back in its own content item, after the fixed item that names its origin, with the origin and the untrusted flag as structured fields;
- snapshots mask a secret field's value, permission requests give only its length, and no result carries it;
- logs keep no URL path, query or fragment, typed text, page text, console text or image;
- a reply or an event of the wrong shape ends the call with an error.

A bullet whose rule the base enforces, such as a call outside the call table, also has its end-to-end test on the real base, named under [Calls on the view](#calls-on-the-view).

### Risk levels

The security model's [risk table](SECURITY-MODEL.md#risk-and-permission) owns each action's risk level, whether it asks the person, its options and what "always" remembers.
The runtime part's unit specs prove the rules:
- `src/noldova.browser/tests/services/risk-classifier.test.ts` classifies each kind of click, typing and key: a submit control of a form, Enter in a form field and the type tool's submit option are medium, or high when the form holds a secret field; any input into a secret field is high; every other click, typing and key, and one the tool can't classify, is medium;
- `src/noldova.browser/tests/models/tool-descriptors.test.ts` checks that each tool's default is the lowest level its calls reach and that no classification passes its maximum;
- the click, type and press-key specs in `src/noldova.browser/tests/tools/` check each request's risk, options and details: a click is judged by the topmost element at its point, and a request for a secret field gives only the text's length;
- `src/noldova.browser/tests/tools/browser-tools.test.ts` sends every tool's calls through Noldova Desktop's own permission center, whose checker refuses a request from a read-only tool;
- `src/noldova.browser/tests/risk-table.test.ts` has one test for each row of the table, titled with the row's action, which sends the row's calls through Noldova Desktop's own permission center and asserts each request's risk, whether it asks, its options and what a kept answer decides later; its last test reads the table from SECURITY-MODEL.md and fails when a row has no test or a test names no row.
  The row for downloads, uploads, new windows, site permissions, authentication and certificate errors checks that the view's calls and the module's tools include none that would do them, since Noldova Desktop refuses them.
  A page's own new window after an agent's click is opened only on the person's recent input: `window/tests/app/services/pages.spec.ts` checks that a request without it is only offered, and Noldova Desktop's `web-view-host.test.ts` checks that input the runtime part relayed never counts as the person's.

An app's end-to-end specs repeat the medium and high rows on real pages, in the app's built form, and asserts that nothing happens on the page before the answer:
- "a teammate opens a site on this computer without a card at Low risk" opens an allowed site with no card, and checks that the form's server gets nothing before the person allows the typing and the click;
- "a teammate's click, key, typing into a password field and submit of the form that holds it each reach the page only after the person allows its card" denies each card first, then allows it: typing and a key at medium risk, a click at medium risk, typing into a password field at high risk with the text hidden, and the click that submits its form at high risk; it ends on a navigation to a site the workspace doesn't allow yet, at medium risk with "Allow this site for the workspace" and no allow once, which it denies.

## Test doubles

The tests use Noldova Desktop 0.0.1's own fakes of what it hands the parts, from `@noldova/desktop.runtime/testing`, `@noldova/desktop.window/testing` and `@noldova/desktop.protocol/testing`, as Desktop's `documents/MODULES.md` "Testing a module" requires.
A member a test doesn't answer throws `UnansweredCallException`, so a call the code never meant to make fails the test, and a member Desktop adds or changes breaks the build.
The fixtures below only give those fakes their answers, as Desktop's main process and registries answer the module; each is typed against the published types and keeps no copy of them.

| Fixture | Desktop's fakes it answers | What it answers |
|---|---|---|
| `ScriptedViews`, in the runtime package's tests | `FakeRuntimeWebViews` and its `FakeWebViewRelay` | As Desktop's main process: the open views as `WebViewInfo` with their profile keys, navigation, each view's allowed origins, profile clearing and the views' events; relay calls checked by Desktop's own `WebViewDeclaration` over the module's `webViews.json`, method and parameters in their wire form, with `ViewClosed` for a view that isn't open, `NotOwned` for another module's view, `Crashed` for a crashed one and `NotAllowed` for a call the declaration refuses; a close fails the view's pending and later calls, a crash fails its calls until a navigation that starts recovers it, while it still takes allowed origins and answers a reload with `NoHistory`, and a cleared profile ends its own views' pending calls, crashed ones too, and keeps them open; a `Runtime.enable` hears again each isolated world the view's document holds, as the engine reports the contexts it holds. Scripts say what each method answers, fails with or whether it hangs; a method no script names throws. |
| `BrowserContext` and `SqliteModuleDatabase` | `FakeRuntimePartContext` and `FakeModuleDatabase` | Desktop's own tool registry and permission center, through `answerThroughRegistry`, the scripted views, each declared setting's stored value, or its default from `settings.json`, and Desktop's `SettingUnknownException` for a setting the module doesn't declare, and the methods and events the part registers, each refused twice; the database is an in-memory SQLite database, through `node:sqlite`, with the migrations it is given applied, which rolls a failed transaction back; `failNext` fails the next call of the kind it names, `read`, `readAll`, `run` or `transaction`, with the test's error, as a full disk does. |
| `WindowContext` and `FakeWebViews`, in the window package's tests | `FakeWindowPartContext` and `FakeWindowWebViews` | The documents, commands and status-bar items the part registers, each item as Desktop's own `StatusBarItem`, the documents it opens, closes and updates, its working marks, the requests it sends with a scripted answer for each, its settings and the links it opens; each open makes a `FakeWebView`. As strict as Desktop's registration, it refuses a request, document, command or status-bar item `module.json` doesn't declare, a second registration of one, a status-bar item's command `module.json` doesn't declare and a setting `settings.json` doesn't declare, answers a declared setting with its default, and throws, through Desktop's `beStrict`, on any other member it doesn't answer; a listener that throws on a document's close fails the spec that closed it; its lists of methods, documents, commands, status-bar items and setting defaults are copies of the two declarations, kept equal by hand. |
| `FakeWebView` | Noldova Desktop's `IWebViewHandle`, of which Desktop 0.0.1 ships no fake | Mounts in an element it fills, loads no address until its first mount, shows and hides by its visibility, lays a layer over it and closes, navigates, goes back and forward, reloads and stops, with Desktop's `WebViewNavigation` answers, and sends each view's `WebViewEvent`s: state, failed load, refused navigation, crash, cleared profile, refused request, new window and close. |
| `PermissionAnswers` and `CorePermissionRequests`, in the runtime package's tests | Noldova Desktop's own `PermissionCenter`, with a store of remembered answers in memory, `MemoryRememberedPermissions`; Desktop 0.0.1 ships no fake of `IToolCallPermissions` | The center checks each request against the running tool's declaration, decides one a kept answer matches, and asks `PermissionAnswers`, the app's `IPermissionAnswerer`, for the rest: it records each request and answers at once with a scripted decision, or once the test answers or expires it. |
| `MemoryRememberedPermissions`, in the runtime package's tests | Noldova Desktop's `RememberedPermissionStore` | Keeps each remembered answer by module, action, subject and scope, the latest one for a match deciding, and lists and forgets them by id. |

### Contract suites

- Each double has one contract suite, a set of tests written once against the contract's interface.
- A double of the module's own keeps its suite beside it, `tests/fixtures/scripted-views.test.ts` and `tests/fixtures/memory-remembered-permissions.test.ts`; these are the only test files that mirror a fixture rather than a production file.
- Two test files test what no TypeScript file holds, so they mirror none: `tests/module-declaration.test.ts` tests the module's `module.json`, `settings.json` and `webViews.json`, and `tests/risk-table.test.ts` runs every tool against SECURITY-MODEL.md's table of each tool's risk.
- The unit tests run each suite against its double.
- The end-to-end workflows run the same suite against Noldova Desktop in the fixture host app.
- A case that fails against the real base fixes the double, and the suite keeps the case.

## The fixture host app

**Not yet:** the serial tests, slow runs and checks on a real desktop that use the fixture host app are the design they follow; none is built.

The end-to-end workflows run in a fixture host app in this repository: an app built on Noldova Desktop's published packages, with this module's package in its `desktop.modules`, as Noldova Desktop's MODULES.md says under "Modules from packages".
- **Its template** is `e2e/app`: its `package.json` pins Noldova Desktop's published packages and names the module's package and two modules of its own, the agent double and the relay double, in its `desktop.modules`.
- **`npm run test:e2e:prepare`** copies the template to `_build/e2e-app`, installs the module's three packages from the archives `npm run build` packed into `_packages`, pins the agent double's dependency on the module at the module's version, copies the module's `webViews.json` into the relay double, and builds the app with Noldova Desktop's build, as an app does.
- **The agent double,** `e2e/app/src/modules/agent-double`, opens a page as an app does: its window part runs the module's `browser.openPage` with the workspace `e2e` and the address a test names, which a window part may only run for a module it depends on.
  It also opens one agent session, calls the tools a test names and answers each permission request with the answer the test plans, for the workflows that call the tools.
  A call may name the session's bindings, such as the page's instance, which `TestApp.openPageAsync` returns, and its workspace; the double then ends a session opened with other bindings and opens one with these, as an app binds a conversation to its page.
- **The relay double,** `e2e/app/src/modules/relay-double`, opens one web view on a document of its own and sends the calls a test names through Noldova Desktop's relay, under a copy of the module's `webViews.json`, so the relay judges them as it judges the module's; the module's own code sends only what its tools need, and has no way to send anything else.
- **Each double's opening** goes from its runtime part to its window part as an event, and Noldova Desktop keeps no event for a window part that isn't listening yet.
  The window's Settings button, which a test waits for before it starts, can be enabled before every window part has activated, so each runtime part holds an opening until its window part has subscribed and said so through `agent-double.listen` or `relay-double.listen`.
  `doubles.spec.ts` asks each double to open as soon as it takes the request, before the start check: the relay double's window part activates after the agent double's, so its test checks the gap, while the agent double's part is nearly always listening by then, so its test checks the wiring, its `listen` call and method.
  `e2e/tests/held-event.test.ts` checks the hold itself, in both doubles' copies, over Noldova Desktop's own event channel.
- **`npm run test:e2e`** type-checks `e2e` and runs `e2e/specs` with Playwright, one test at a time, each test in an app of its own with new data and device folders, which it quits through Noldova Desktop's command line.
  `test-app.spec.ts` quits an app it launches itself twice, the second time after Playwright has seen it close, so a quit never asks Playwright for an app it already closed ([#63](https://github.com/noldova-com/browser/issues/63)), and checks that the app's downloads folder is its own, and that a page's session downloads there, a page the restart restores too.

- Playwright drives the app as the base's desktop UI automation does.
- The production security settings stay as they are: the view's sandbox and context isolation stay on, and the view has no preload.
- Each launch setting that differs from production is recorded with its reason in `e2e/fixtures/launch-settings.ts`, and each test lists them in its report:
  - GPU acceleration off, with no software stand-in, and one color profile, as in the base's workflows.
  - A stand-in camera and microphone, which grant nothing, so a refused camera or microphone is the base's refusal rather than a runner with no device.
  - Host resolver rules that map the fixture servers' `.test` names to `127.0.0.1` and fail every other lookup, while `localhost`, `.localhost` names and `127.0.0.1`, where the recording proxy listens, keep the engine's own loopback.
  - A proxy on loopback for every address that isn't loopback, which records each request and answers none, so a request to an address literal that the base fails to refuse never leaves the machine, with `.test` names left out of it, as loopback addresses are, so they reach their fixture servers.
  - On macOS, no windows restored from an earlier run.
  - A downloads folder of the app's own, beside its data and device folders, which the test sets with `app.setPath("downloads", …)` in the main process right after each launch, and with `setDownloadPath` on every session there is then, every one made after and the session of every web contents made after, since Electron gives a session its downloads folder when the session is made and a restart may restore a page, and make its session before its web contents, before the test reaches the app, so `denials.spec.ts` reads a new folder and never the account's own Downloads, which macOS lets a process read only once the person grants it ([#92](https://github.com/noldova-com/browser/issues/92)).
  - A forced device scale factor, only in the screenshot scale workflow.
- An agent tool is called through the base's tool registry in the fixture host app, with the agent session that the call names.
- A test reads each view's address, title and whether it is loading, and the addresses its view committed, from the main process with `e2e/fixtures/view-pages.ts`, and may run a fixture page's own script in its view; the page itself gets no test hook.
  A script whose view closes under it, as a move between groups closes the page's old view, fails with "The view at … closed.", since Electron's own call never answers then.
  It reads each view's session, cookies and storage folder there too, and the cookies of the app's window and default sessions.
- A test may give the window's page a size with `TestApp.resizeAsync`, as the person's drag of the window's edge does, and read from the main process whether the state a view's page last committed to its history holds a text, with `ViewPages.holdsPageStateAsync`.
- A test may restart the app on the same data and device folders; the requests recorded before the restart stay in the record the loopback guard reads at the test's end.

### Fixture servers

- Every fixture server listens on `127.0.0.1` on a port the system picks, and belongs to one test; the "Loopback range" row's server listens on `127.0.0.2` instead, on a platform that routes it.
- A test that fails, or whose app doesn't start, attaches two logs to its report, each line with its time: `requests.log`, each fixture server's requests with the client's port and the `Sec-Fetch-*` and purpose headers that say what kind of request each is, and `views.log`, each view's creation, navigation starts and destruction, read from the main process before the app quits ([#37](https://github.com/noldova-com/browser/issues/37)).
  A check that fails after the app has quit, such as the loopback proxy's, attaches no `views.log`.
  `failure-logs.spec.ts` attaches `views.log` from a passing test across a restart and checks its lines.
- A test may hold a path's answer with `hold`, so a view stays loading it until the test releases it, and may close a server, which keeps its port, so the loopback guard still knows its host.
- A fixture origin a test allows is a `.localhost` name on its own server, such as `allowed.localhost`, so origins are matched by host as well as by port and scheme.
- Fixture servers listen on loopback, so each fixture origin a test allows has an exact entry in the fixture host app's Sites on this computer or network setting, which takes a `.localhost` name as a local entry and refuses any other name, as the [security model](SECURITY-MODEL.md) says.
- A `.test` name, such as `blocked.test`, which the host resolver rules map to `127.0.0.1`, is a name that isn't local and resolves to this computer, which the base refuses whatever the allowed origins hold.
- A test that needs HTTPS serves it with a self-signed certificate made for that run by the runner's `openssl` command line, in a temporary folder removed once the certificate is read, so no key is committed or left on disk; the test fails, rather than skips, when `openssl` is missing.
  A certificate the view doesn't trust is one of the [default denials](#isolation-and-default-denials).
- **No request leaves loopback:** the harness records, from the main process, every request of each view's session, as each ends, and each test fails at its end when the recording proxy received a request, or when a view's request named a host that is not one of its fixture servers and wasn't refused by the base before it left the app.
  The guard reads once no view's request is in flight, and the recording proxy is read again after the app quits, so a late request fails the run too.
  `e2e/fixtures/loopback-guard.ts` holds the guard, which requires at a test's end exactly the violations the test's `expectedViolations` option names, none by default; `loopback-only.spec.ts` names the ones its page's request causes, so the test passes only when the guard reports them, word for word.

## End-to-end workflows

**Not yet:** of these workflows, `loopback-only.spec.ts`, `schemes.spec.ts`, `relay-refusals.spec.ts`, `denials.spec.ts`, `isolation.spec.ts`, `new-page.spec.ts`, `find-on-page.spec.ts`, `long-snapshot.spec.ts`, `snapshot-options.spec.ts`, `closed-roots.spec.ts`, `long-page.spec.ts`, `agent-bar.spec.ts`, `hidden-press.spec.ts`, `agent-tools.spec.ts`, `crash.spec.ts` and `link-tabs.spec.ts` exist, `page.spec.ts` with all its row but two parts, `navigation.spec.ts` with its test that an allowed origin loads, and `blocked-origins.spec.ts` with the navigation rows from "Origin not allowed" to "IPv4-mapped link-local" and "History entry no longer allowed", each started from the page itself: a link, a form, the page's script, a meta refresh, a server redirect, a subframe and an allowed subframe's link to the top, or, for the history row, the page's `history.back()` once the view has an entry to go back to.
`page.spec.ts` leaves out the moves between windows, since Noldova Desktop opens one window today and its window "never opens another window" (Noldova Desktop's `WINDOW.md`; [#107](https://github.com/noldova-com/browser/issues/107)), and a page the base gave no view, which needs a fixture-only double that makes `webViews.openAsync` fail, in its own pull request.
Its moves between groups go through the tab's menu, opened with Shift+F10, since Noldova Desktop gives its window commands no default keys, and it waits until the page has committed a typed field's value before each move, since Noldova Desktop restores a moved view's new page from what the page last committed to its history, about a second after a change.
Each blocked-origin test asserts that the view stays at its last allowed address, done loading, with no navigation committed in the view or in a subframe, that the main process's record shows no request for the target that the base didn't refuse, since the base refuses a page's own navigation before its request and a redirect at its request, and that no fixture server received a request for another host; for a top-level start other than going back, it also asserts that the page started the navigation, by the page's own `navigate` event, and that the pane shows the refusal naming the refused origin, which Noldova Desktop reports since 0.0.3 ([desktop#122](https://github.com/noldova-com/desktop/pull/122)).
A meta refresh's page is refused as it loads, so its start first loads a plain allowed page, which shows that no earlier start's refusal is left.
The history row doesn't assert the pane's refusal: the test sees no navigation start in the page for it, so nothing shows the refusal would be the history entry's rather than a leftover.
So that those records can't pass empty, each start's page also has an allowed control frame, and the test asserts that the view committed the start page, that a subframe committed the control frame, and that the record shows the start page loaded.
On macOS, which doesn't route `127.0.0.2`, the "Loopback range" row has no fixture server at that address, and the main process's record alone proves its refusal.
`subresources.spec.ts` has the rows "Subresource on loopback", "Trailing dot on a refused host", "Subresource on a private address", "Subresource redirected to a private address", "Subresource on a link-local or unspecified address", "Subresource on a local scheme", "Subresource on the app's window URL", "Subresource on another public origin", "Local entry on a loopback address", "Repeated load", "Service worker", "Request through a proxy to a refused URL" and "WebSocket to another public origin".
A subframe is refused by the base before its request, as a page's own navigation is, so its test asserts that the view finishes loading with no subframe committed at the address and that the record shows no request for it that wasn't refused; an allowed control frame started beside it must commit and show its load in the record, so those checks can't pass on empty records.
A `file:` subresource is refused by the engine before it becomes a request, so its test asserts that the page sees it fail and that the main process's record shows no completed request for it; a redirected request has no WebSocket kind, since a WebSocket follows no redirect, and the loading row has no `wss:` kind, since the fixture servers don't answer TLS.
The bridge's navigate, back and forward come with the agent tools; each other workflow, the rest of `navigation.spec.ts` and the navigation and subresource rows for the base's local endpoint and the app's tool server come in their own pull requests; those rows wait on the Noldova Desktop release that fixes [desktop#125](https://github.com/noldova-com/desktop/issues/125), since the base doesn't refuse those endpoints today.
The fixture host app's window URL is a `file:` URL, which the engine refuses before a page's navigation to it starts, so `schemes.spec.ts`'s `file:` row covers the navigation row "The app's window URL", and `subresources.spec.ts` its subresource row.
"WebSocket to an allowed origin" comes with `permissions.spec.ts`, since a public origin is allowed only through the permission contract and `browser.localSites` takes only loopback and private origins; "Local entry on a loopback address" already asserts that a `ws:` socket reaches an allowed local origin.
The public-origin rows use a fixture server's `.test` name: the address checks judge the name without resolving it, so it is a public origin, while the launch's host resolver rules still send it to `127.0.0.1`.
They use `http:` and `ws:` where the security model's rows name `https:` and `wss:`, since the fixture servers don't answer TLS; the base maps `wss:` to `https:` as it maps `ws:` to `http:`, and a refused `wss:` needs no TLS, so the refused WebSocket row asserts both.
"Request through a proxy to a refused URL" uses the launch's recording proxy, the app-wide proxy, since the module sets no proxy on its partition; a control request to the public address `203.0.113.10` must reach the proxy, so the proxy's empty record for the refused URL means refused rather than never proxied; the test declares the control's two records as the guard's expected violations, so any other request that leaves still fails it.
The redirect row also asserts that the allowed server received each first hop, and "Repeated load" that the record shows both loads completed from the allowed server's address.

| Workflow | What it proves |
|---|---|
| `page.spec.ts` | The page's view follows its document through resizes and moves between groups and, in [#107](https://github.com/noldova-com/browser/issues/107), windows; a menu or dialog lies over the live view; the pane shows loading, a failed load, a refused navigation, a person's link click to a local or a public site outside the workspace's list as refused, a crashed page with a way to reload, and a page the base gave no view as unavailable. |
| `navigation.spec.ts` | Allowed origins load; the bridge's navigate, back, forward and reload check the allow list before loading, including a history entry whose origin has since left the list. |
| `blocked-origins.spec.ts` | Each navigation row of the [blocked-origin table](#blocked-origins). |
| `schemes.spec.ts` | A navigation loads only `https:`, `http:` and `about:blank`. |
| `refused-frame-link.spec.ts` | The person's click on a link in another site's frame, to a site the workspace doesn't allow, shows the refused page in that frame, sized to it, and leaves the page and the pane as they were, naming the app's browser ([#48](https://github.com/noldova-com/browser/issues/48)); it clicks once the frame reports the pointer over the link, working around [desktop#459](https://github.com/noldova-com/desktop/issues/459): just after another site's frame shows, the pointer at first reaches the page around it, not the frame, so a click there right away is lost; it is skipped on macOS, where a click sent to another site's frame within about 2 s of its load is lost ([desktop#459](https://github.com/noldova-com/desktop/issues/459)). |
| `subresources.spec.ts` | Each subresource row of the [blocked-origin table](#blocked-origins), the no-cache and service-worker cases. |
| `relay-refusals.spec.ts` | The relay refuses each [refused call](#calls-on-the-view), a child target's session, a foreign view id and `DOM.describeNode` at a depth the file doesn't declare, and holds its time and size limits. |
| `isolation.spec.ts` | The view is isolated from the app, from other profiles and from the runtime. |
| `denials.spec.ts` | Each default denial. |
| `permissions.spec.ts` | A refused origin, once the person allows it through the permission contract, loads; a denied or expired request leaves it refused. |
| `agent-tools.spec.ts` | Each tool acts on a real page: navigate, snapshot, click by reference, type, screenshot and console reading, each checked by what the fixture page records. A covered element is reported, not clicked. |
| `crash.spec.ts` | A crashed view ends every pending call with an error within its time limit: a snapshot, a screenshot or a wait whose own command waits on the page, and the calls the module holds behind it, since it runs a page's calls one at a time. |
| `screenshot-scale.spec.ts` | A capture's decoded image is the view's size in CSS pixels times the device scale factor, scaled by `min(1, 1600 / its longer side in device pixels)` with the aspect ratio kept, for a view under the cap and one over it, at 1 and at a forced 2. |
| `focus.spec.ts` | Focus moves into the page on a click and back to the pane's own controls. |
| `new-page.spec.ts` | The tab row's New page button sits flush before the group's own buttons at their size, is named "New page" and shows its key in its tooltip, and opens an empty page at the row's end on the page's workspace with its address field focused; Ctrl+T, or Cmd+T on macOS, opens one from the toolbar and from inside the page, and reaches the part that has the focus in the window's own elements outside every page. |
| `link-tabs.spec.ts` | The person's middle click on a link opens its tab behind the page at once, twice in a row too, and the tab loads its link once shown; a script's new window right after waits in the page's notice, a page's handler that opens two windows on one middle or Ctrl click opens one tab and holds the second in the notice, and a script's Ctrl clicks open no tab. |
| `find-on-page.spec.ts` | Ctrl+F, or Cmd+F on macOS, pressed inside the page opens the find bar with its field focused; it counts the page's matches as "1 of 2", moves to the next and previous one on Enter and Shift+Enter, says "No matches", and closes on Escape. |
| `agent-bar.spec.ts` | The teammate's bar shows from an agent's first call on a page until its session ends, so the page area moves once as control starts and once as it ends, never between calls. |
| `long-snapshot.spec.ts` | A snapshot of a long page gives the page's first 128 KiB, its first lines and a link with its reference, and the cut note; scrolled down, it starts where the page is scrolled to, after the lines that lead there, with its note; on a page with 12,000 link rows under one element, with short names or 30-word ones, and one with 12,000 rows with a button role and a long attribute each, it gives the first rows with their references and the cut note within the step's 15 seconds, each with its time as an annotation; on the link rows, whose search ends either way by the machine, either the note names the rows' element with how many of its children went unsearched, or the closed root of a box among them is read; on the last, whose rows' element is too large to describe, the note that its closed roots weren't searched; a page of 200 rows that the search must split is searched whole, with no such note. The search running out of time is forced with a set clock in the unit tests. |
| `closed-roots.spec.ts` | A custom element's closed root is read after its host's line, its secret field masked, and its button is read as a part and clicked by reference; a built-in element's closed root shows its own lines with the light children its slot shows, in order; a closed root after a document too large for one answer is found by describing the document a part at a time, with the time as an annotation; an element too large to describe is named as not searched, and a closed root inside it shows only its host's line; a closed root within the 128 KiB is read and one past it is cut, with the cut note. |
| `snapshot-options.spec.ts` | The snapshot names and roles every element an agent acts on, and every heading, as the engine's own accessibility tree does, on a page with most kinds of element; it masks a password, a card number, a one-time code and a new password inside the page and shows another field's value; `interactive` keeps only those elements and the headings; `depth` leaves out deeper lines with its note, and a part read by the reference of an element at the last level gives that element's subtree; a part by a reference no snapshot gave fails as unknown, and one whose element left the page as stale. |
| `long-page.spec.ts` | On a page whose tree passes the 4 MiB reply bound, a key goes to the focused field, which the permission request names, and a wait for a field's value isn't met while one for text the page shows across two elements is; on a page whose document passes it, a click on a link and an Enter on a focused link ask at medium risk, and a click on a button whose form holds a password field inside a closed shadow root asks at high risk. |
| `hidden-press.spec.ts` | An agent's click reaches the document that a hidden tab's page loaded after a GET and after a POST navigation, and a person's press, through the window's mouse at the view once the page has painted, reaches that document once the tab is shown after an agent's call marked its view, checked by what the page records. |
| `click-in-view.spec.ts` | An agent's click on a button whose centre is in view, cut at the view's bottom edge or taller than the view, as the spec checks before the click, reaches it with no scroll, the page's scroll, the view's height and the button's place unchanged; one below the view is scrolled to, and one out of an inner pane's view, its centre in the page's view, is scrolled into the pane's view, and both are clicked. |
| `keys.spec.ts` | The app's shortcuts reach the window while the page has focus, and every other key reaches the page; an agent's key event that matches an app shortcut is refused as `Refused` with the module code `browser.shortcutRefused`, the person's own press of that shortcut still works, and an agent's inserted text is not checked against shortcuts. |
| `agent-input-focus.spec.ts` | While the person types in a field of the window, an agent's key events and inserted text reach the page and don't take keyboard focus from that field. |
| `loopback-only.spec.ts` | The no-request-leaves-loopback guard fails a run. |

A request a test makes to the app fails after 65 s without an answer, naming its method: a tool's longest deadline, 60 s, and 5 s for the answer to come back through the test app, so it fits any request the app answers in its own time, and a hang fails well before the test's 2-minute timeout.
A failed test keeps its trace, `trace.zip` in its results folder, with its steps, fixtures and Playwright calls, which name where it waited; a passed test's trace is deleted.

The [architecture](ARCHITECTURE.md#8-buffers-and-limits) caps a capture's longer side at 1,600 pixels, and how the base reports a capture's size has changed between Electron versions, so `screenshot-scale.spec.ts` asserts the decoded image's pixels, whichever format it comes in, on the Electron version the module pins.

### Blocked origins

The [blocked-origin table](SECURITY-MODEL.md#blocked-origins) owns the cases, for navigations and for subresources.
Each row has one test, titled with the row's case name: a navigation row in `blocked-origins.spec.ts` and a subresource row in `subresources.spec.ts`.
A check fails when a row has no test or a test names no row.

The table's example hosts show each case's relation to the allowed origin.
A test builds the same relation from fixture origins, such as the same name on another port, a subdomain, a look-alike name or an address literal, since a fixture server can't listen on the example's host or its default port.
A row of an IPv6 form of an IPv4 address, IPv4-mapped, IPv4-compatible or NAT64, writes the row's address in that form: a loopback form names the fixture server's address and port, and a private or link-local form goes to the recording proxy, so a refusal that misses the form is recorded.
A loopback row whose address isn't `127.0.0.1`, such as `127.0.0.2`, has the main process's record prove the refusal on every platform, and its fixture server listens on that address where the platform routes it.

A navigation row's test starts the navigation in every way that applies to its case: the bridge's navigate, back or forward to a history entry, a link, a form, `window.location` set by the fixture page's own script when a fixture control starts it, a meta refresh, a server redirect and a subframe.
It asserts that the navigation is refused, that the page stays at its last allowed URL, that the module receives the refused-navigation event with the URL, for a top-level navigation shown as the pane's refusal naming the refused origin, and that the refused origin's fixture server and the recording proxy received no request.

A subresource row's test loads an allowed page that makes each kind of request to the row's address: `fetch`, an image, a script, an iframe, a beacon by `navigator.sendBeacon`, and a WebSocket by `ws:` and by `wss:`.
It asserts the outcome the row gives each kind; a WebSocket, for one, reaches only an origin on the allow list.
For a request refused by its URL, the test asserts that the page sees it fail, that the main process's record shows it refused, and that the fixture server or the recording proxy at that address received nothing.
For a row that loads, such as another public origin or a loopback origin with a local-marked entry, it asserts that each request is reached, so the refusals don't come from a broken fixture.

`subresources.spec.ts` also has the security model's "Repeated load" and "Service worker" rows:
- "Repeated load" loads one URL twice, with caching headers that would allow a cache, and asserts that its fixture server received both requests;
- "Service worker" registers a worker script on an allowed page, and asserts that the registration fails and that the main process's record shows the script's request, with its `Service-Worker` header, refused.

### Schemes

`schemes.spec.ts` proves that a navigation loads only `https:`, `http:` and `about:blank`.
Every other scheme, `file:`, `data:`, `blob:`, `view-source:`, `devtools:`, the browser's internal `chrome:` pages and the app's own `desktop-file:` protocol, is refused from a link and from the page's script, with the page's own origin allowed, since the base reads the scheme before the allow list.
A top-level `about:srcdoc` from a link or the page's script ends in the engine's error page, which Noldova Desktop reports as a refused navigation since 0.0.3 ([desktop#114](https://github.com/noldova-com/desktop/pull/114)): the test asserts that the pane shows the refusal naming `about:srcdoc`, that the view is done loading at `about:srcdoc`, that the allowed server received no request for it, which the guard checks for every other host, and that typing the allowed address into the pane loads it again.
A page's own `javascript:` link and location run in the page's own document: the test asserts that the script ran, that the view keeps its address and origin, and that it committed no navigation; a `javascript:` address typed into the pane's address field is refused with the pane's message and runs nothing.
The engine refuses most of them before the base sees the navigation, so the pane shows no refusal; each test sets the page's title after the navigation starts, through the same channel, and asserts that the view stays at its last allowed address with that title, done loading, and committed no navigation.
A subresource may still use `data:` and `blob:`, which never leave the page, and the test proves that they load; a subframe by `srcdoc`, `data:` or `blob:` follows its row of the [blocked-origin table](#blocked-origins).

### Calls on the view

The security model's [call table](SECURITY-MODEL.md#calls-on-the-view) owns which calls the relay allows and refuses.
`relay-refusals.spec.ts` has one test for each refused method of the table, titled with the method, such as `Page.navigate`, `Runtime.evaluate`, `Runtime.addBinding`, `DOM.setFileInputFiles`, `DOM.getOuterHTML` and `Input.dispatchDragEvent`, and one test for each refused domain, titled with the domain; a domain row whose refusal is "every other method" has one test for a method it doesn't name.
A test reads the table's rows and the fixed set above it, and fails when a refused method or domain has no test, or a test names none.
Each test sends its call through [the relay double](#the-fixture-host-app) to its own real view, and asserts that the call is refused as `NotAllowed` and that the page's URL, its document and the scripts it runs stay unchanged; a declared call before and after it is answered, so a refusal can't come from a broken double.
The calls come from the double under a copy of the module's `webViews.json`, not from the module itself, whose own calls the unit tests of its scripted views check.

The same file has a named test for each of the relay's other refusals and limits:
- `child target session`: a declared call that names a cross-site frame's session is refused, and a declared call after it is answered; the test attaches to that frame's target from the main process and reads its address through the session first, so the session exists and is the child's;
- `foreign view id`: a call to the module's own open view, from the double, is refused as `NotOwned`, which a view that doesn't exist wouldn't be, the module's page is unchanged, and declared calls on the double's own view are answered before and after;
- `time limit`: a declared call with a 1-second limit, which the free page answers within, ends as `TimedOut` once the test holds the page's main thread, and the page answers again once the test releases it, which it does whatever the call's outcome;
- `size limit`: a read of the whole subtree of the document's node, `DOM.describeNode` by the backend id the double takes from `DOM.getDocument` at depth 0, on a page whose markup the test makes one byte longer than the relay's 4 MiB reply bound, ends as `TooLarge`.

### Isolation and default denials

`isolation.spec.ts` proves that:
- the page sees none of the app's bridge or preload globals;
- the app's own protocols refuse a request from the page, while a request to the app's tool server is the blocked-origin table's "Subresource on the app's tool server" row;
- a page that gathers WebRTC ICE candidates learns no local or private address from them, under the view's `disable_non_proxied_udp` policy;
- cookies, local storage and IndexedDB written under one profile key are absent under another key and in the app's window;
- clearing a profile key empties its storage, and a key keeps its storage across a restart of the app;
- the view's session is never the app's default session, and its partition's name holds the module's id and the profile key.

Each `isolation.spec.ts` test is titled with its item.
- The globals test checks the base's bridge, `desktop`, and Node's and Electron's names, such as `require`, `process` and `ipcRenderer`, after checking that the app's window has the bridge.
- The protocol test fetches, and loads as an image, an address on the base's shared-file protocol, `desktop-file:`, which the page must fail to reach.
  Both would fail even on a session that served the protocol, since the scheme lacks the fetch privilege and the address names no grant, so the main process also checks that no view's session handles `desktop-file:`, with the window's session, which does, as the control.
- The WebRTC test gathers the candidates of a data channel's offer, with no STUN server, and finds none: under the policy the view gathers no host candidate, while without it Chromium would gather host candidates whose `.local` names hide the address, so a test for address literals alone would pass without the policy.
- The storage tests write a cookie that outlives the session, a local storage item and an IndexedDB record, and read all three back.
  A second profile key's page reads none of them; the main process finds the cookie only in the first key's session, not in the window's or the default session.
  Clearing goes through the pane's Clear browsing data… and its dialog, as the person does, and the next page's read is polled until it finds nothing; the restart quits the app and launches it again on the same folders.

The security model's [Denied by default](SECURITY-MODEL.md#denied-by-default) list owns the default denials.
`denials.spec.ts` has one test for each item of that list, titled with the item: the camera, the microphone, location, notifications, clipboard reading, USB, serial, HID, Bluetooth, every other permission the engine can ask for, screen capture, downloads, new windows and pop-ups, file choosers, authentication prompts, certificate errors and embedded `<webview>` elements.
The test of "every other permission the engine can ask for" asks for a permission outside the list, MIDI with system-exclusive access, so a handler that only lists the named permissions fails it.
A check fails when an item has no test, or a test names none.
Each test asserts that the view refuses with no prompt and no file left behind; a download is tried by an attachment response and by a link's `download` attribute, and a new window by `window.open` and by a link that targets one.
- The page sees the refusal: the request's promise rejects or resolves as denied, `window.open` returns `null`, the file input stays empty, and a refused sign-in shows the server's own 401 page with no second request.
- Where the engine answers a permission query, it reports the item as denied, so a refusal for another reason, such as clipboard reading in a page without focus, doesn't pass the test.
- No prompt: the app's windows and contents read from the main process are the same before and after.
- No file stays in the downloads folder: within 10 seconds, the files in the folder itself are again those it held before, and a file that stays fails the check, which names it.
  The check waits because the engine writes a temporary file there for each download before the app can refuse it, and removes it a few milliseconds later.
  The folder's subfolders are left out, since on a Linux runner that folder is the home folder, where the engine keeps its certificate store.
- The pane shows Browser's notice for each request the base reports: a site permission, screen capture, a download, a file chooser and a sign-in; a new window shows the pane's pop-up offer.
  The base refuses a USB, serial, HID or Bluetooth chooser with no report, so those tests check the page's refusal and that nothing opened.
  Since the runner has no devices, the page's refusal alone would pass without the base's denial: the main process records each USB, serial and HID chooser the view's session offers, and every test asserts it offered none.
  Noldova Desktop turns Web Bluetooth off in every window, so the Bluetooth test asserts the page has no `navigator.bluetooth` on every system.
  Since the runner has no Bluetooth device either, the test also offers the view a device choice from the main process, as the engine does when a page asks for one, and asserts the view takes it and chooses no device.
  Electron itself cancels a choice that no other handler takes, and the base's handler cancels it too, so this check fails when a handler chooses a device, or lets the choice through without `preventDefault()`, the one case where Electron chooses the first device itself, but not when the base's handler is missing.
  A certificate error reports a refusal and then fails the load, so the pane shows the failed load and the certificate's notice, and the fixture server receives no request.
- An embedded `<webview>` element stays an unknown element in the page, since the view has no `<webview>` support, and asks for nothing.
- A download is tried from a freshly loaded page each time, since a page load clears the pane's notice; the test then finds no file with its name under the downloads folder or the app's folders.

## Serial tests

**Not yet:** these are end-to-end workflows in [the fixture host app](#the-fixture-host-app), each in its own pull request.

These tests need the operating system's foreground focus, which a platform can't isolate per process, so they run last and one at a time, as the organization's standard allows:
- `focus.spec.ts`: focus moving between the page and the window;
- `keys.spec.ts`: the person's own keys reaching the window or the page;
- `agent-input-focus.spec.ts`: the person typing in a field of the window while an agent types in the page.

An agent's clicks and keys reach the page through the relay without the operating system's foreground focus, so the tests in `agent-tools.spec.ts` run in parallel.
A test that shows it needs the foreground focus, or the system clipboard, joins this list by name.

## Slow runs

**Not yet:** these are end-to-end workflows in [the fixture host app](#the-fixture-host-app), each in its own pull request.

A slow run repeats a workflow while busy threads load the machine's CPU, to find timing bugs that only slower runners show.
These race-prone workflows are each run 30 times without retries, on Windows and on Linux, with the load starting at the first test, before they count as stable and again after a change to the code they race:
- `permissions.spec.ts`: a navigation that waits for the person's answer, and a request that expires;
- `page.spec.ts`: the view following its document when the document moves to another group;
- `agent-tools.spec.ts`: a screenshot taken as soon as a page loads;
- `crash.spec.ts`: a crash while calls are pending.

Slow runs are never part of a gate.

## Checks on a real desktop

**Not yet:** these checks need the end-to-end workflows and a packaged app of [the fixture host app](#the-fixture-host-app), which come in their own pull requests.

CI's runners have displays at one device pixel per CSS pixel and no person's desktop session, so these checks run on real machines.
Each report names the machine's operating system and CPU.

| Check | Machine | Evidence |
|---|---|---|
| Screenshots at a real display scale | macOS with a Retina display at 2x; Windows with its display at 150% | The decoded image's size against the view's CSS size times the display's scale, capped as `screenshot-scale.spec.ts` expects, for a view under the cap and one over it, the scale the operating system reports, and the capture attached |
| A page moved between displays of different scales | macOS with its Retina display at 2x and a second display at 1x | After each move, on each display: the decoded image's size against the view's CSS size times that display's scale, capped the same way, the view's bounds against its place's, and a click and keys landing on their target in the page |
| Foreground focus and input | Windows and macOS, each in a signed-in desktop session | The [serial tests'](#serial-tests) results |
| The packaged app keeps the view's isolation | The packaged and signed app that integrates the module, on each operating system | `isolation.spec.ts`, `denials.spec.ts` and `schemes.spec.ts` against the packaged binary, with its sandbox and fuses as shipped |
| Agent input to a hidden page | Windows and macOS, each in a signed-in desktop session | A click, typed text and a key sent while the page's tab is behind the chat each reach the page, as the fixture page records; the unit tests prove only what is sent |
| A refused download never reaches the operating system | Windows, macOS and a Linux desktop session | No save dialog opens, no file stays in the downloads folder past the engine's own temporary file, which it removes within milliseconds, and the module receives the refusal |

## Fixed pauses and coverage exclusions

No test file pauses for a fixed time; the two specs that wait for an animation frame are listed, with its reason, in the README's [Checks](../README.md#fixed-pauses).
`npm test` first runs the pause check, `scripts/checks/pause-check.ts`, which reads every file under `src/*/tests/` and `src/*/*/tests/` and refuses these forms, comments included:
- Playwright's `waitForTimeout`;
- a promise that `setTimeout` or `setInterval` resolves;
- `setTimeout`, `setInterval` or `scheduler.wait` from `node:timers/promises`;
- `Atomics.wait` and `Atomics.waitAsync`.

A load of `node:timers/promises` that the check can't follow, such as one not bound to a name, is refused as a whole.
Each refusal names the file, the line and the form, and `npm test` then fails before it builds anything or runs any test.
The check also fails for each package under `src/`, a folder there that holds a `package.json`, when neither it nor any folder in it has a `tests` folder, such as the module package's `tests`, and when it finds no test file at all, so a moved or renamed tests folder can't pass unread; the end-to-end specs, once they exist, live in those `tests` folders too.

The check reads text, not the program: a promise whose `resolve` a timer settles outside the promise's own `new Promise(...)` call, such as one handed to a `setTimeout` later, gets through, and review catches it.
A `new Promise` that holds a `setTimeout` is refused even when the timer only rejects, so a test bounds a wait with `vi.waitFor`'s `timeout` or with `AbortSignal.timeout`, not with a timer of its own.

The coverage exclusions, each with its reason, are in the README's [Checks](../README.md#checks).
Both coverage tables leave out the files with nothing to run, the interfaces, types and declarations, so the tables list only code.
`scripts/tests/installed-package/activate-browser.ts` keeps its values in `scripts/resources.ts` and fails with `InstalledPackageException`, both copied into the fixture app at their paths in the repository.

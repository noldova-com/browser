# Changelog

**Scope:** What each published version of Browser's packages holds, newest first.

Each version's section is written by the pull request that changes the version, from the pull requests merged since the previous version; other pull requests don't edit this file.

## 0.0.3

- `@noldova/browser` takes Noldova Desktop's protocol and runtime packages as peers at `>=0.0.3 <0.1.0`, as `module.json`'s `noldovaDesktop` does, and `@noldova/browser.window` depends on its protocol and window packages at 0.0.3 (#20, #58).
  A page's own refused top-level navigation, which Noldova Desktop reports since 0.0.3, now shows the pane's refused state naming the refused origin, and a refused page with no origin of its own, such as `about:srcdoc`, is named by its address (#58).
- An agent's call marks the page's view as controlled with Noldova Desktop's `setControlledAsync` for as long as the agent controls the page, so a page in a hidden tab keeps drawing and an agent's press reaches a document it loaded while hidden.
  A call whose view can't be marked does nothing and fails as `Unavailable` with the new code `browser.notControlled`; a view marked by an earlier start of the runtime part, which no control holds, stops being marked (#42).
- A page whose accessibility tree is too large for one reply is still snapshotted, read a part at a time with `Accessibility.getRootAXNode` and `Accessibility.getChildAXNodes`, which `webViews.json` now declares with `Accessibility.enable` and `Accessibility.disable` (#52).
  On such a page, a key press reads the focused element, `browser_wait_for` checks the page's shown text with the pinned `PageTextScript`, and the snapshot reads from where the page is scrolled to, through the read-only calls `webViews.json` adds for them (#55).
- The teammate's bar shows for as long as an agent controls a page, from its first call until the page closes, the person takes over or stops the agent, or the session ends, rather than once per call (#54); the page's tab shows no accent underline while an agent uses it (#51).
- Each approval card names the element and the site, such as `Click "Choose Team" on docs.example.com` (#31).
- The tab row of a group that holds a Browser page has a New page button, from the page document's tab-row menu place `browser.pageTabRow` in `menus.json` (#32).
- Find on page opens a find bar under the toolbar, from More or `Mod+F` (#35).
- A refused request's notice that comes while a page loads stays through that load, its commit and its failure (#24).
- A new page's tab reads "New tab", its address field stays empty and its record keeps no address while its view is at `about:blank`, whether or not the window part heard the view's start there; before, the tab could read "about:blank" (#62).

## 0.0.2

- The packages are published through npm's trusted publishing, with provenance, so the release stores no token.

## 0.0.1

- The first version of `@noldova/browser`, `@noldova/browser.window` and `@noldova/browser.protocol`, under the MIT License.
  The three packages move together.
- `@noldova/browser` holds `module.json`, `settings.json` and `webViews.json` and the runtime part, and exports `./runtime`, with `RuntimePart` and `BrowserLimits`, and `./window`, which re-exports the window package.
  It takes context's `@noldova/context.exceptions` and `@noldova/context.json` as peers at `>=0.0.7 <0.1.0`, and its exceptions extend context's `Exception` through one base, `BrowserRuntimeException`.
  It reads the window part's requests with the protocol's `fromJson`, so a request with a field it doesn't name is refused.
- `@noldova/browser.protocol` holds what the runtime and window parts share: the tool names, methods and events, the page scripts, the address kinds and local sites, and the enums `AddressKind`, `PageAction`, `PageActivityState`, `TypedAddressAnswerKind` and `TypedAddressRefusal`, whose values are their members' names.
  Each message the runtime and window parts exchange is a model class with `toJson` and a static `fromJson`, which refuses a malformed or unknown field with context's `JsonException` naming the field's path: `PageRecord`, `PageRequest`, `PageClaim`, `HeldPages`, `PageAgent`, `PageActivity`, `PageBox`, `PagePoint`, `PageRefusal`, `OpenPagesRequest`, `PageStopRequest`, `BrowsingDataRequest`, `TypedAddressRequest`, `TypedRedirectRequest`, `TypedAddressAllowed` and `TypedAddressRefused`, and `TypedAddressAnswerReader` reads either typed-address answer.
  It takes context's `@noldova/context.json` and `@noldova/context.exceptions` as peers at `>=0.0.7 <0.1.0`.
- `@noldova/browser.window` holds the window part, `windowPart`, with `PaneController`, `PaneHearing`, `PaneStates`, `PaneStatus`, `PlaceholderTracker`, `PopupOffer` and the view events, `ViewEvent` and its ten kinds' classes, the enums `AddressRefusal`, `PaneState`, `RefusedRequest` and `ViewEventKind`, and its exceptions' base, `BrowserWindowException`, with `PaneUnavailableException`.

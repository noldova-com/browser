# Changelog

**Scope:** What each published version of Browser's packages holds, newest first.

Each version's section is written by the pull request that changes the version, from the pull requests merged since the previous version; other pull requests don't edit this file.

## 0.0.4

- `@noldova/browser` takes Noldova Desktop's protocol and runtime packages as peers at `>=0.0.8 <0.1.0`, as `module.json`'s `noldovaDesktop` does, and `@noldova/browser.window` takes Noldova Desktop's protocol and window packages as peers at `>=0.0.8 <0.1.0` (#71, #80, #82, #94, #101) and `@noldova/ui.components.angular` at `>=0.0.17 <0.1.0` (#73, #109).
- A typed address whose host holds a star, written, full-width or percent-encoded, is refused as not an address, and an origin that an earlier version kept that way is dropped when the module updates.
- `browser_snapshot` takes `interactive`, the elements an agent acts on and the headings, `depth`, 1 to 100 levels, and `part`, one element's subtree by a reference an earlier snapshot gave; its answer is bounded at 128 KiB, cut at a line's end with a note on how to read more (#78).
  A reference no snapshot gave fails as `Refused` with the new code `browser.unknownReference`, and one whose element left the page as `Refused` with `browser.staleReference`.
  The snapshot comes from one in-page function pinned in `webViews.json`, which no longer declares `Accessibility.getRootAXNode` or `Accessibility.getPartialAXTree` with its relatives.
- A snapshot under a node whose children pass one reply reads them one element at a time, with `DOM.describeNode` at depth 1, which `webViews.json` now allows, and the walk sends its next reads together, so a page of thousands of rows under one element is read within the call's time (#69).
- Click, type and press-key read the element they act on for their risk check with one pinned function, `ElementFactsScript`, which `@noldova/browser.protocol` exports, instead of the whole document, so they work on a page whose document passes one reply; `webViews.json` adds `DOM.resolveNode` and `Runtime.releaseObject` for it and allows `DOM.getDocument` at depth 0 only (#66).
- A click presses an element that shows at its centre where it is, without scrolling the page; any other element is scrolled to first, and pressed once the page rests (#85).
- Typing into a field that replaces itself when it takes the focus, as some sites' search boxes do, fails as a changed page, `Stale`, which asks for a new snapshot, instead of an uncertain outcome (#103).
- A page's own refused navigation to a public site that isn't among the workspace's sites is headed "This workspace doesn't allow" and the origin, and says the address isn't among the sites the workspace allows; `@noldova/browser.protocol` exports `AddressLimits` (#98).
- Reload on a crashed page loads its address again (#105).
- Tests and CI: the end-to-end workflows for the page's placement and states (#106), each agent tool on a real page (#89), a crash's pending calls (#90), Bluetooth on every system (#102) and a person's refused link click (#112); the test app's start, close and downloads folder (#65, #87, #97), a failed test's attachments (#64) and click-in-view's placement (#111); and the workflows at `.github`'s v2.40.0 (#75, #96, #114).
  The packages are unchanged by these.

## 0.0.3

- `@noldova/browser` takes Noldova Desktop's protocol and runtime packages as peers at `>=0.0.3 <0.1.0`, as `module.json`'s `noldovaDesktop` does, and `@noldova/browser.window` takes Noldova Desktop's protocol and window packages as peers at `>=0.0.3 <0.1.0` (#20, #58).
  A page's own refused top-level navigation, which Noldova Desktop reports since 0.0.3, now shows the pane's refused state naming the refused origin, and a refused page with no origin of its own, such as `about:srcdoc`, is named by its address (#58).
- An agent's call marks the page's view as controlled with Noldova Desktop's `setControlledAsync` for as long as the agent controls the page, so a page in a hidden tab keeps drawing and an agent's press reaches a document it loaded while hidden.
  A call whose view can't be marked does nothing and fails as `Unavailable` with the new code `browser.notControlled`; a view marked by an earlier start of the runtime part, which no control holds, stops being marked (#42).
- A page whose accessibility tree is too large for one reply is still snapshotted, read a part at a time with `Accessibility.getRootAXNode` and `Accessibility.getChildAXNodes`, which `webViews.json` now declares with `Accessibility.enable` and `Accessibility.disable` (#52).
  On such a page, a key press reads the focused element, `browser_wait_for` checks the page's shown text with a fixed page script, and the snapshot reads from where the page is scrolled to, through the read-only calls `webViews.json` adds for them (#55).
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

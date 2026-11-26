# Changelog

**Scope:** What each published version of Browser's packages holds, newest first.

Each version's section is written by the pull request that changes the version, from the pull requests merged since the previous version; other pull requests don't edit this file.

## 0.0.8

- `@noldova/browser` takes Noldova Desktop's protocol and runtime packages as peers at `>=0.0.17 <0.1.0`, as `module.json`'s `noldovaDesktop` does, up from `>=0.0.14` (#44, #65).
- `@noldova/browser.window` depends on Noldova Desktop's protocol and window packages at 0.0.17, up from 0.0.14 (#44, #65), and on the UI kit, `@noldova/ui.components.angular`, at 0.0.33, up from 0.0.28 (#41, #52, #61).

## 0.0.7

- `@noldova/browser` takes Noldova Desktop's protocol and runtime packages as peers at `>=0.0.14 <0.1.0`, as `module.json`'s `noldovaDesktop` does, and follows each view's navigations from its opening, so a navigation that starts before any tool read the view is still waited on and reported as the page still loading (#259).
- A page's tab shows the site's favicon as its image, with the `public` glyph in its place while the page has none, while it loads, after it fails and in forced colours (#285).
- An agent's key that Noldova Desktop refuses as one of the app's shortcuts fails as `Refused` with `browser.shortcutRefused`, no longer as `OutcomeUncertain` (#294).
- Before each press, `browser_click` rates the element it lands on when that element is inside the referenced one, and when that element rates high and the referenced one didn't, presses nothing and refuses the call with the new code `browser.innerElementRiskier` (#24).
- A click on a `LABEL`, or on what it holds other than interactive content, is rated as a click on the control it activates; the pinned element-facts function in `webViews.json` changes with it (#25).
- Enter in a checkbox, a radio button or any other input of a form but a button or a reset button is rated as submitting that form (#26).
- `browser_press_key` answers a single control character, such as a carriage return or a line feed, as an unknown key and sends nothing; a named key such as `Enter` or `Tab` presses it (#21).
- A typed address is judged again against the settings' local origins inside its workspace's turn, so an origin Settings removed meanwhile is refused and never stored (#22).
- An agent's call on a page during a typed load stops that load's later redirects whether or not one has passed yet (#23).
- A field's value no longer shows in the names that `browser_wait_for` matches or that a confirmation card and a tool's result show (#30).
- `browser_type` types only into the element that holds the focus after it focused the field: an element outside the field, or none, fails as `Stale` with the new code `browser.focusMoved`, and a focused element inside the field whose risk is above what the person allowed fails with `browser.riskRose`; a new pinned function in `webViews.json` reads the focused element (#29).

## 0.0.6

- `browser.openPage` takes `profileKey` as optional: without one, the page opens in the person's own browsing, the workspace `links`, at `url` when given, for a command the person runs for themselves, such as an app's Open browser; its address goes through the origin check of `links` and isn't allowed first, as a link's is. An `instance` without a `profileKey` is refused as invalid arguments, so no agent session binds to the person's own browsing, and `links` given by name stays refused (#279).
- A form whose `aria-labelledby` id another tree of the page also uses is named from its own tree's element, as the browser resolves it, no longer from the first element of that id in the page (#273).

## 0.0.5

- `@noldova/browser` takes Noldova Desktop's protocol and runtime packages as peers at `>=0.0.13 <0.1.0`, as `module.json`'s `noldovaDesktop` does, and `@noldova/browser.window` takes Noldova Desktop's protocol and window packages as peers at `>=0.0.13 <0.1.0` (#159, #189, #196, #254, #258) and `@noldova/ui.components.angular` at `>=0.0.26 <0.1.0` (#161, #172, #186, #198, #202, #211, #217, #240, #256).
  The three packages take `@noldova/context.exceptions` and `@noldova/context.json` as peers at `>=0.0.12 <0.1.0`, and `@noldova/browser.window` (#236) and `@noldova/browser` (#242) now take `@noldova/context.core` as a peer, which each part's entry imports first; every context peer starts at 0.0.12 (#251).
- `browser_navigate`'s wait ends on a move within the document, `Page.navigatedWithinDocument`, which `webViews.json` now declares, unless the frame took a new document first (#157).
- `browser_navigate` takes a load only once the main frame has committed the document of the newest navigation started since its wait began, through `Page.frameStartedNavigating`, which `webViews.json` now declares; `browser_wait_for` says how long it waited and sends `Page.enable` before a load wait (#212).
- After the person allows a navigation, `browser_navigate` reads the page again and fails as `Stale`, moving nowhere, when its document or address changed since the card; once the move has loaded, a page that landed elsewhere than asked fails with the new code `browser.landedElsewhere`, as `OutcomeUncertain` (#193).
- Reload on a page that failed to load reloads the address that failed, read from the frame's `unreachableUrl`, and the card's From names it (#219).
- A frame's URL keeps its fragment in every tool's text and the console's navigation lines, and navigate's landing checks match a page at a fragment; the structured page still holds only the origin and path (#215).
- A Stop or Take over while `browser_navigate` allows a new site leaves the page where it was, and a queued call whose session ended takes no control of the page; both fail as stopped (#187).
- `browser_wait_for` hears a page again in each frame that navigates, and reads the page once more at its limit (#167).
- A view whose Runtime start fails stops its tracker, so a reference lookup on it gives nothing at once and the next use starts it again in full (#229).
- `browser_type` replaces what its field holds, and an empty text clears it, through a new pinned function in `webViews.json`; a field that isn't a text field gets the text at its caret, as before (#203).
  `browser_type` reads the document again after its text, and `browser_press_key` after a key other than Enter or Space, and fails as `OutcomeUncertain` when it changed; the documents state the window that remains for a click, Enter and Space (#207).
- `browser_press_key` with Shift and a letter sends its capital, and typed text, addresses and references count their length in code points, as the tools' schemas do (#208).
- A click on, or a screenshot of, an element the engine doesn't lay out, such as one under `display: none`, fails as not visible, `browser.notVisible`, instead of a protocol failure, and `browser_type` refuses such a field before any input (#209).
- A scrolled snapshot whose start falls inside an element its walk doesn't enter, such as an svg icon's path or a hidden part, starts at that element instead of giving only its ancestors' lines (#204).
- A click, a typed Enter or a pressed key that navigates the main frame is reported with the page the navigation loaded, or with the page's address and a still-loading note when the call's time ends first; `webViews.json` declares `Page.frameRequestedNavigation` and `Page.frameStoppedLoading` for it (#243).
- While the main frame waits for its next document, a call waits for it only as long as its time allows: `browser_snapshot` and `browser_screenshot` report the page still shown as still loading, `browser_console` answers at once, and an answer that reports a page still loading reads its address and title from the view's history (#246, #252).
  A click, typing, a key press or a navigation whose page is still loading at the call's read margin fails as `Unavailable` with the new code `browser.pageLoading`, before any input.
- `browser_screenshot` reads the frame again after its capture and fails as `Stale`, keeping no image, when the page went to another document meanwhile, so an image never carries another document's origin (#263).
- The element facts that rate a click's or an Enter's risk take the form the engine resolves in the element's own tree, so a button in a shadow root no longer takes the page's form of the same id; the pinned function in `webViews.json` changes with it (#265).
- The workspace key `links` is the module's own: `browser.openPage` refuses it as invalid arguments, and a tool call whose session is bound to it fails as `Unavailable` with `browser.unbound`, so an agent never acts in the person's own browsing (#266).
- A typed address that Noldova Desktop refuses stays in the field, marked invalid and described by the refused page's heading, until the person edits it or enters again (#163).
- Enter held down in the address field enters the address once; an entered address still waiting for its answer is left when another navigation starts, a load starts, an agent's call that can move the page starts, or the person presses Stop or Escape; and the lock and "Not secure" show only beside the page's own address (#199).
  `@noldova/browser.protocol` exports `TypedAddressLeft`, `TypedAddressAnswerKind.Left` and `TypedAddressRequest`'s `instance`.
- A typed private address or a name in `.local` with no scheme defaults to `http:`, or to the scheme of the single site Sites on this computer or network names at its host and port (#218).
- Ctrl+L (Cmd+L on macOS), Escape and F6 work while the page has the focus; Escape stops a loading page, from the `stop` loading key `webViews.json` now declares, and reaches a page that loaded (#237).
- A page's new window opens only for a request that used the person's press, or from a site in the new setting Allow pop-ups, `browser.popupSites`; any other is blocked, with Pop-up blocked in the toolbar, whose menu opens the pop-up or always allows pop-ups from its host (#234).
- A middle, Ctrl or Cmd click on a link opens its tab at once for each click, behind the page (#91).
- A link in another site's frame to a site the workspace doesn't allow shows the refused page in that frame, naming the view "<app>'s browser" (#99).
- Every text of the pane that names the module says "<app>'s browser", or "this browser" while the app's name is unknown (#183); the new-window notice starts with a capital, and the local-sites hint and setting ask for the address with its scheme (#173).
- The agent bar's button reads and is named Stop teammate, apart from the toolbar's Stop (#174), and the teammate tag ends with its ellipsis at the page's right edge instead of being cut off (#170).
- A request notice is announced only when its text changes (#175), and a stopped pop-up's notice and a typed address's refusal stay through the same load's commit, title, stop and failure (#225).
- A restored page whose record can't be read shows "This page can't open again" with Close instead of staying blank (#164), and such a page opened again shows in its tab (#221).
- A restored tab that hasn't shown yet comes forward at its kept address when `browser.openPage` names its instance with another address (#270).
- A restored tab whose claim failed keeps a page that a run here claims while the tab's record is read, instead of marking it moved to another window (#271).
- A zoom event whose factor isn't a finite number above zero is dropped instead of showing "NaN%", and the window part asks to be rebuilt instead of failing when it deactivates during a reconnect (#272).
- Closing a page's tab drops its refusal (#220) and a pending place it never showed (#223), and a page closed while its tab awaits its claim or its view opens no view and keeps no agent or record (#224).
- A page whose view is opening keeps its place in the window, so a run of `browser.openPage` on another workspace fails and one on its own brings it forward (#226).
- New page and Ctrl+T are off on a page whose view never opened or has closed, and open nothing beside it (#268).
- The find bar and More's Find on page work only while the page loads or is loaded; an open bar closes when its page leaves those states, giving Reload a focus it held, and a page that comes back from another window shows no bar (#264).
- When another window takes the shown page while the focus is inside it, the focus moves to the state's Close (#200).
- A tab keeps its title while its page loads without one of its own, a title that only repeats the page's address included, and shows the address only once a load ends without a title, so a restored tab no longer reads New tab and then its address before its title (#261).
- Tests and CI: the zoom and scroll reset in the window specs (#166), an end-to-end request's answer limit and a failed test's trace (#169), the downloads folder check after a refusal (#180), the window run's session logs and pinned headless shell (#184, #190), commits, failed loads and a renderer's end in `views.log` (#214), the page keys spec's wait for a painted page (#247), the fixture app's committed lockfile (#249), vitest at 5.0.5 (#231), context's development pins at 0.0.9 and 0.0.10 (#177, #192), and the workflows at `.github`'s v2.41.0, v2.41.1, v2.41.2 and v2.41.4 (#182, #206, #228, #233).
  The packages are unchanged by these.

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

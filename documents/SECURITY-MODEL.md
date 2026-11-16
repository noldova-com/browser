# Security model

**Scope:** What isolates the browser's pages, which URLs may load, which calls the module may make on the view, each agent action's risk and permission, what the module refuses even with permission, what results and logs never carry, and which changes count as risky in review.

The organization's security standard, `https://github.com/noldova-com/.github/blob/main/standards/SECURITY.md`, applies here in full.
The packages, processes, tool registration, tools and limits are in [ARCHITECTURE.md](ARCHITECTURE.md).
Reporting a vulnerability is in the [security policy](../.github/SECURITY.md).

## Threats

The module loads pages it doesn't trust and lets agents act on them.
It defends against:

- **A hostile page that reaches for the app:** its window, its protocols, its credentials or its main process.
- **A page that steers the agent:** text, markup or images that tell the agent to act, to read other data or to send it somewhere.
- **An agent that oversteps:** it leaves the allowed origins, reads or sends out the person's data, types a secret, or acts without the person's approval.
- **A leak:** page content, typed text or secrets that reach a log, a file, another agent session or another workspace.

The module trusts the base's main process, the person's answers to permission requests and the app's configuration.
It trusts nothing that comes from the page, from a tool's arguments or from the agent's output.

## Isolation

The base's web views, as its `WEB-VIEWS.md` sets them, guarantee:

- The base's main process creates and owns one view per page document, and the module never holds the view itself.
- The view is sandboxed, with context isolation on, no preload, and none of the app's protocols, credentials or messages to the app.
  A message from the view never counts as one from the app's window.
- Each workspace has its own persistent partition, which all its pages share, named by the base, never the default session and never another workspace's or module's partition.
  A workspace is the profile key the app gives `browser.openPage`; nothing from a page or an agent names one.
- Clearing a workspace's partition removes its cookies, storage and cache, and ends every pending request.
- Each view's WebRTC IP handling policy is `disable_non_proxied_udp`, so a page can neither learn local addresses nor send direct UDP.
- The teammate's mark the window draws lies in the view's layer, an element of the window's page that the page in the view can't read or reach and that takes no pointer.

Besides the partition, the module writes only its database: each workspace's allowed origins, and each open page's workspace, last address and the name of the agent whose call last acted on it, which it deletes when the person closes the page's document.
Page content, page text, console messages and screenshots never go to a file.

## Denied by default

The base refuses these for a page's session:

- the camera;
- the microphone;
- location;
- notifications;
- clipboard reading;
- USB devices;
- serial ports;
- HID devices;
- Bluetooth devices;
- every other permission the engine can ask for;
- screen capture;
- downloads;
- new windows and pop-ups, which it never opens: the page's view asks for `newWindows`, so the base hands the request to the window part instead, as [New windows](#new-windows) says;
- file choosers;
- authentication prompts;
- certificate errors, which fail the load with no way to proceed;
- embedded `<webview>` elements.

The module asks for none of them in the preview.

## URL policy

The checks come in two sets.
The address checks apply to every request the page makes, whatever its type: navigations, subframes, and subresources such as `fetch()`, images, scripts, styles, fonts, media, workers and WebSockets on `ws:` and `wss:`.
The navigation checks apply on top of them to every navigation of the page or of a subframe.
The first check that fails refuses the request.

### Address checks

1. **Parsing:** the URL parses as a WHATWG URL and is at most 32,768 characters long.
2. **Local schemes:** `file:`, the engine's internal pages and the app's own protocols are refused.
3. **Credentials:** a URL with a user name or a password is refused.
4. **Never allowed:** the endpoint of the app's tool server, the base's local endpoint, the app's window URL, the unspecified addresses `0.0.0.0/8` and `::`, and the link-local ranges `169.254.0.0/16` and `fe80::/10` are refused, even when the person allows their host.
5. **Loopback and private addresses:** an origin whose host is loopback (`127.0.0.0/8`, `::1`, `localhost` or a name that ends in `.localhost`), private (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` or `fc00::/7`) or in the shared address space (`100.64.0.0/10`) is refused unless an exact allowed origin names it, port included.
   A wildcard never matches them.

Rules 4 and 5 judge the URL's canonical host, as the WHATWG parser writes it, without resolving it.
An IPv6 address that carries an IPv4 address is judged as that IPv4 address: IPv4-mapped (`::ffff:0:0/96`), IPv4-compatible (`::/96`, other than `::` and `::1`) and NAT64 (`64:ff9b::/96`).
So `http://[::ffff:127.0.0.1]/`, which the parser writes as `http://[::ffff:7f00:1]/`, is loopback.

On a page the navigation checks allowed, a subresource on any other origin loads, since pages take content from other origins.
A WebSocket is the exception: `ws:` and `wss:` connect only to allowed origins, `ws:` counted as `http:` and `wss:` as `https:` of the same host and port.

### Navigation checks

1. **Scheme:** only `https:` and `http:` load, `about:blank` is the empty page, and a subframe may also load `about:srcdoc`, which takes its parent's origin.
   Every other scheme is refused before the allowed origins are consulted: `data:`, `blob:`, any other `about:` page, `view-source:` and `devtools:`, besides those the address checks refuse.
   A page's own top-level navigation to `about:srcdoc` is refused by the engine itself, before the base sees it: the engine commits its own error page in place of the view's page, and nothing loads; [desktop#109](https://github.com/noldova-com/desktop/issues/109) has the base report it as a refused navigation.
   A page's own `javascript:` link or location runs as that page's script, as in every browser: it runs in the page's own document and loads nothing, so the page keeps its address and origin.
   A `javascript:` address typed into the pane, or given to the agent's navigate tool, is refused and runs nothing.
   Subframes take these checks too, so a `data:` or `blob:` frame is refused in the preview, even on an allowed page.
2. **Origin:** the URL's origin must equal an allowed origin.

The allowed origins start empty, so nothing loads but `about:blank` until the person allows an origin.

### Matching

Origins match exactly, by scheme, host and port, after the WHATWG parser's normalization: lower case, punycode, the default port dropped, and the numeric forms of an IPv4 address written as four decimal parts.
`http:` and `https:` of one host are two origins, and so are two ports of one host.
A host with a trailing dot doesn't match the same host without it.
A `*.` wildcard matches whole labels only: `*.example.com` matches `a.example.com` and `a.b.example.com`, not `example.com`, `badexample.com` or an IP address.
Only the person adds a wildcard, in the app's settings.
No check compares a prefix, a suffix or a substring of a URL.

Before the address checks compare, they also drop a trailing dot, so `localhost.` and `127.0.0.1.` are refused like `localhost` and `127.0.0.1`.
Only matching against the allowed origins keeps the trailing dot, since a host that doesn't match is refused.

Since an origin joins the allowed origins when the person approves an agent's request for it, an agent that a page has misled can ask for an attacker's origin, so being allowed is a weak barrier; [Risk and permission](#risk-and-permission) says how the request guards against it.

### Connected addresses

The bridge's navigate, back, forward and reload resolve their host before they load, and are refused when it doesn't resolve, or resolves to a link-local or unspecified address, or to a loopback or private one whose origin isn't a local entry of the allowed origins.
A redirect whose response carries an address is refused by the same rule, judged by that address.

A local entry is an allowed origin whose host is an IP address, `localhost` or a name that ends in `.localhost`, which the engine always resolves to loopback and never through DNS, and which the person names in the app's settings.
Only the app's settings mark an entry as local; a permission request's answer, "always" included, never does.
The app's settings' origins are the exact origins the person names in Sites on this computer or network, `browser.localSites`, which the module only reads: no tool's arguments, page or agent output changes them, and an entry there is never a wildcard. An agent's navigation to a loopback or private origin they don't name fails as `Refused` with `browser.originRefused`, before it asks anything, with a message that names the setting, so the agent can ask the person to name it; a permission request never allows one. An entry whose host is a name other than `localhost` or one that ends in `.localhost` would get no local mark, so it is still refused when its name resolves to this computer or its network; Settings refuses such an entry, and a public, link-local or unspecified one, and the runtime part leaves each out.

The pane's partition keeps no HTTP cache, so every response comes from the network.
A service worker answers the page's requests itself, so the base refuses a service worker's script, whose request carries the `Service-Worker` header.

### Where the checks run

The base's main process runs the address checks on every request of the pane's partition, of every resource type and redirects included, and judges the bridge's navigations and redirects by the address they resolve to, as [Connected addresses](#connected-addresses) says.
Every navigation also passes the navigation checks, whatever starts it:

- **Started by the module:** the bridge's navigate, back, forward and reload are checked before they load, history entries included, since the allowed origins may have changed since the entry was visited.
- **Started by the page:** links, form submissions, script that sets the location, meta refresh and subframe navigations are checked when they navigate and at each redirect.
- **Started through the relay:** never, since no call that loads or replaces a document is allowed on the view ([Calls on the view](#calls-on-the-view)).

A refused navigation becomes an event to the module, which may ask the person to allow the origin ([Risk and permission](#risk-and-permission)) and then navigates again.
A refused subresource fails in the page, and nobody is asked.
The allowed origins change only by the person's answer to a request, an address the person types in a page's address field, or the app's settings, never by a tool's arguments, the page's content or the agent's output.

### Typed addresses

An address the person types in a page's address field and enters is the person's own action: it raises no permission request, and its origin joins the workspace's allowed origins before the page goes there, as [ARCHITECTURE.md](ARCHITECTURE.md#typed-addresses) says.

- The field is in the window's own page, which the page in the view can't reach, and an agent's input goes to the view, never to the field; so only the person's keys enter an address there.
- The runtime part takes the requests `browser.allowTypedAddress`, `browser.passTypedRedirect`, `browser.endTypedRedirects` and `browser.readyPage` only from the app's main process, for one of its windows, and refuses each as `Unauthorized` from any other client, such as the command line or a module's own entry, or without a window, which Noldova Desktop also routes methods from.
- The runtime part judges the address itself before it adds anything, whatever the window part read: it refuses an address that isn't `http:` or `https:`, one with a user name or a password, one over the length limit, and a link-local or unspecified host.
- A loopback or private origin is never added by typing: it loads only when the app's settings, Sites on this computer or network (`browser.localSites`), already name it exactly, and otherwise the tab's notice names that setting; so typing never gives an entry the local mark.
- An origin is allowed only once the module's database has kept it: until its write succeeds, no view gets it and it stays new to the workspace, and a failed write allows nothing, as [ARCHITECTURE.md](ARCHITECTURE.md#typed-addresses) says.
- The navigation that follows goes through the bridge and passes every check of [Where the checks run](#where-the-checks-run), so the base refuses a redirect out of the allowed origins, as in any navigation.
  While the typed address loads, the window part takes such a redirect as the person's own, as any browser follows it: it sends the redirect's address to `browser.passTypedRedirect`, which judges it by every check of this list, and the tab goes there, or shows the not-allowed page naming the origin the runtime part refuses.
  The runtime part allows a redirect's origin for that page's view only and keeps none: once the load ends, only the page it landed on joins the workspace, through `browser.allowTypedAddress`, and `browser.endTypedRedirects` gives the view back its workspace's origins alone, so an open redirect on the way widens nothing an agent may open.
  It follows ten such redirects at most, none after the load ends, and none once a teammate's call starts on the page during the load, even after that call ended; the page it lands on then joins nothing.
  An agent's call on the page first takes the view's redirect origins away, and the runtime part refuses that view's later redirects until the window ends the load, so a redirect a click sets off never joins, and an agent's navigation and its redirects stay refused outside the allowed origins.
- The never-allowed endpoints of [Address checks](#address-checks), such as the app's tool server, are loopback addresses, so a typed address never adds them, and the base refuses them even when the settings name their host.

### Links

A web link the person opens elsewhere in the app, which Noldova Desktop's open-link path hands to the window part, is the person's own action, as a typed address is, as [ARCHITECTURE.md](ARCHITECTURE.md#links) says.

- Noldova Desktop asks the module only for `http:` and `https:` links; `file:`, `mailto:` and every other scheme keep Noldova Desktop's own handling and never reach `placeFor` or `openAsync`.
- `openAsync` sends the address to the runtime part's `browser.allowTypedAddress`, so every check of [Typed addresses](#typed-addresses) applies: the runtime part refuses an address with a user name or a password, one over the length limit, a link-local or unspecified host, and a loopback or private one the app's settings don't name exactly.
  A refused address loads nothing in the module, and Noldova Desktop opens it in the system's browser instead, logging only the error's name.
- A link's page opens on the module's own workspace, `links`: its cookies, storage and sign-ins are apart from every workspace the app opens pages on for its teammates, and an origin a link allowed there is allowed in no other workspace.
- A teammate acts on a link's page only as on any page, through the tools and their permission requests.
- The site list only sends links to the system's browser, never into the module, so a mistaken entry can't load a page the module would otherwise refuse; it matches a host and its subdomains by the URL parser's canonical host, so a lookalike such as `evilgithub.com` never matches `github.com`, and it reads an entry that holds a host, such as an address, as that host, so no entry matches every link.
- The log names an ignored site entry only by its place in the list, never its text, which may hold an address's path.

### Page records

- The runtime part takes `browser.rememberPage`, `browser.readPage`, `browser.forgetPage`, `browser.claimPage`, `browser.holdPages`, `browser.letGoPage`, `browser.clearBrowsingData`, `browser.stopPage` and `browser.readActivities` only from the app's main process, for one of its windows, and refuses each as `Unauthorized` from any other client, as it does `browser.allowTypedAddress`.
- A record holds a page's instance, its workspace's profile key, checked as a profile key, and its last address, at most 32,768 characters; a malformed request is refused and keeps nothing.
- The runtime part adds the name of the agent whose call last acted on the page, as the app binds it to the agent's session; no window writes it, and it allows nothing: the window shows it only in the status bar's count of each agent's open pages.
- A record allows nothing: a restored page goes to its address through the bridge, and the origin check of [Where the checks run](#where-the-checks-run) applies as to any navigation.
- A restored page with no record opens no view, so it never opens in a workspace it guessed.
- `browser.stopPage` only ends calls: Stop aborts the calls running on the page, and Take over also keeps the session that last acted on it off the page until that session ends, so a stop from a window can't make any call act.
- `browser.pageActivity` tells every window what an agent does on a page: the page's instance, the agent's name, the action, its state, and an element's box and point; it carries no text the agent types and nothing the page holds, and an address only in the end of a navigation whose new origin the person denied.
- That address only offers the person a choice: the window reads it only as an `http:` or `https:` address on its own origin, and its Allow goes there as the person's typed address, through every check of [Typed addresses](#typed-addresses), so an agent's denied navigation never allows a site by itself.
- `browser.readAppName` gives only the app's name from the build's product file, which is no one's own, so the runtime part answers it for any client.

### New windows

- A page's request for a new window never opens one: the window part opens its address as a new page document in the same workspace, through the origin check, only right after the person's own input in the page.
- Any other request only offers the address in the page's notice, and nothing opens until the person chooses Open as a tab.
- A tab opens at most one page while Noldova Desktop counts the person's input as recent, so a page that asks for many windows in one click gets one; its further requests in those 5 seconds only offer their address in the notice, which says a new tab opened a moment ago.
- The new page's view is the module's own, with the page's isolation and defaults; the opener keeps no reference to it, so neither page can script the other.

### Clearing browsing data

- Clear browsing data… asks the person in a dialog first, and only Clear has the runtime part clear the workspace's partition through the base, which removes its cookies, storage and cache and ends every pending request.
- It keeps the workspace's allowed origins, which are the person's choices rather than the sites' data.

### Blocked origins

Each row is a named test in [TESTING.md](TESTING.md).
The allowed origins hold `https://example.com` unless the row says otherwise.
The hosts and ports are examples of each row's relation to an allowed origin, such as another port, a subdomain, a look-alike or an address literal; a test may build the same relation from its own origins.

| Case | Example | Result |
|---|---|---|
| Origin not allowed | `https://example.org/` | Refused; the person may be asked |
| Redirect out of the allowed origins | `https://example.com/go` answers 302 to `https://example.org/` | Refused at the redirect; a typed address's own redirect is judged again as a typed address, as [Typed addresses](#typed-addresses) says |
| Meta refresh out | A page with `<meta http-equiv="refresh" content="0;url=https://example.org/">` | Refused |
| Script sets the location | `location.href = "https://example.org/"` | Refused |
| Form submission out | `<form method="post" action="https://example.org/">` | Refused |
| Subframe out | `<iframe src="https://example.org/">` | The frame is refused, and the page stays |
| Subframe navigates the top | A link with `target="_top"` to `https://example.org/` in an allowed subframe | Refused |
| History entry no longer allowed | Back to an origin removed from the allowed origins | Refused |
| Scheme change | `http://example.com/` | Refused |
| Port change | `https://example.com:8443/` | Refused |
| Subdomain without a wildcard | `https://a.example.com/` | Refused |
| Look-alike host | `https://example.com.example.org/`, `https://badexample.com/` | Refused |
| Credentials | `https://user@example.com/`, `https://example.com@example.org/` | Refused |
| Trailing dot | `https://example.com./` | Refused |
| Punycode look-alike | `https://exаmple.com/` with a Cyrillic `а`, which parses to an `xn--` host | Refused |
| IP literal for an allowed name | The address of `example.com`, or `http://2130706433/` | Refused |
| Loopback | `http://localhost:4200/`, `http://127.0.0.1:4200/`, `http://[::1]:4200/` | Refused unless the person allows that exact origin |
| Loopback range | `http://127.0.0.2:4200/` | Refused unless the person allows that exact origin |
| IPv4-mapped loopback | `http://[::ffff:127.0.0.1]:4200/`, which parses to `[::ffff:7f00:1]` | Refused unless the person allows that exact origin |
| IPv4-compatible loopback | `http://[::127.0.0.1]:4200/`, which parses to `[::7f00:1]` | Refused unless the person allows that exact origin |
| NAT64 loopback | `http://[64:ff9b::7f00:1]:4200/` | Refused unless the person allows that exact origin |
| Loopback, another port | `http://localhost:4201/` with `http://localhost:4200` allowed | Refused |
| Private range | `http://10.0.0.1/`, `http://172.16.0.1/`, `http://192.168.1.1/`, `http://[fd00::1]/` | Refused unless the person allows that exact origin |
| IPv4-mapped private address | `http://[::ffff:192.168.1.1]/`, which parses to `[::ffff:c0a8:101]` | Refused unless the person allows that exact origin |
| Shared address space | `http://100.64.0.1/` | Refused unless the person allows that exact origin |
| Wildcard and a loopback name | `http://app.localhost:4200/` with `*.localhost` allowed | Refused |
| Unspecified address | `http://0.0.0.0:4200/`, `http://0.1.2.3:4200/`, `http://[::]:4200/` | Always refused |
| Link-local | `http://169.254.169.254/`, `http://[fe80::1]/` | Always refused |
| IPv4-mapped link-local | `http://[::ffff:169.254.169.254]/`, which parses to `[::ffff:a9fe:a9fe]` | Always refused |
| The base's local endpoint | Its endpoint, even with that origin allowed | Always refused |
| The app's tool server | Its endpoint, even with that origin allowed | Always refused |
| The app's window URL | The window's own URL | Always refused |
| Other schemes | `file:`, `data:`, `blob:`, `view-source:`, `devtools:` | Always refused |
| `about:srcdoc` at the top | A link to `about:srcdoc` on an allowed page | Refused by the engine, which commits its own error page in place of the view's page; nothing loads; [desktop#109](https://github.com/noldova-com/desktop/issues/109) has the base report it as a refused navigation |
| A page's own `javascript:` URL | A link to `javascript:document.title = "Hi"` on an allowed page | Runs in the page's own document and loads nothing; the page keeps its address and origin |
| A typed `javascript:` address | `javascript:alert(1)` typed into the pane's address field | Refused; runs nothing |
| `srcdoc` subframe | `<iframe srcdoc="<p>Hello</p>">` on an allowed page | Loads, with its parent's origin |
| `data:` or `blob:` subframe | `<iframe src="data:text/html,<p>Hello</p>">`, or a frame on a `blob:` URL, on an allowed page | Refused |
| Navigation through the relay | `Page.navigate` to an allowed origin | Refused: the method isn't allowed |
| Subresource on another public origin | `<img src="https://example.org/a.png">` on an allowed page | Loads |
| Subresource on loopback | `fetch("http://127.0.0.1:4200/")`, or a WebSocket to `ws://localhost:4200/`, from an allowed page | Refused unless the person allows that exact origin |
| Subresource on a private address | `<img src="http://192.168.1.1/a.png">` on an allowed page | Refused unless the person allows that exact origin |
| Subresource redirected to a private address | `https://example.org/a.png` answers 302 to `http://192.168.1.1/a.png` | Refused at the redirect |
| Subresource on a link-local or unspecified address | `fetch("http://169.254.169.254/")`, `fetch("http://0.0.0.0:4200/")` | Always refused |
| Subresource on the base's local endpoint | `fetch()` to its endpoint, even with that origin allowed | Always refused |
| Subresource on the app's tool server | `fetch()` to its endpoint, even with that origin allowed | Always refused |
| Subresource on a local scheme | `<img src="file:///a.png">` | Always refused |
| Subresource on the app's window URL | `fetch()` to the window's own URL, whatever its scheme | Always refused |
| Trailing dot on a refused host | `http://localhost.:4200/`, `http://127.0.0.1.:4200/`, `http://169.254.169.254./`, with nothing allowed or with `http://localhost:4200` allowed | Refused, like the plain form |
| Local entry on a loopback address | `http://localhost:4200` or `http://127.0.0.1:4200` named in the app's settings | Loads |
| Repeated load | `https://example.com/a.png` loaded twice | Both responses come from the network, each with its connected address |
| Service worker | `navigator.serviceWorker.register("/sw.js")` on an allowed page | Refused |
| Request through a proxy to a refused URL | `http://192.168.1.1/` through the partition's proxy, with nothing allowed | Refused by the address checks |
| WebSocket to an allowed origin | `wss://app.example.com/` with `https://app.example.com` allowed | Connects |
| WebSocket to another public origin | `new WebSocket("wss://example.org/")` on an allowed page, with `https://example.org` not allowed | Refused |

## Calls on the view

The module drives the page through the base's relay to the DevTools protocol.
Noldova Desktop's relay refuses a fixed set whatever a module declares: the Target, Browser, Fetch and Security domains, and `Page.navigate`, `Page.navigateToHistoryEntry`, `Page.reload`, `Page.setDocumentContent`, `Page.resetNavigationHistory`, `Page.setInterceptFileChooserDialog`, `Page.disable`, `Page.setDownloadBehavior`, `Page.close`, `Page.crash`, `Network.setRequestInterception` and `Network.continueInterceptedRequest`. It also refuses a request that names a child target's session, and bounds every result.
The module declares the calls it sends and the events it takes in `webViews.json`, with bounds on the parameters that need them, and Noldova Desktop's host refuses every other call and forwards no other event, without running the module's code.
The file declares a call only with the tool or the part that sends it: today the calls of the eight built tools and the events `Page.loadEventFired`, `Page.frameNavigated`, `Runtime.consoleAPICalled`, `Runtime.exceptionThrown`, `Runtime.executionContextCreated`, `Runtime.executionContextDestroyed`, `Runtime.executionContextsCleared`, `Runtime.bindingCalled` and `Log.entryAdded`, with bounds such as `DOM.getDocument` only whole and through shadow roots, `DOM.describeNode` as one node, or its whole subtree through shadow roots, mouse presses of at most three clicks, key texts of at most two code units, inserted text of at most 10,000, and captures only as PNG or as JPEG at quality 20 to 80, of an area at most 4,096 CSS pixels a side, never scaled up.
The press-key tool's schema can't say that its modifiers are unique, so the tool refuses a repeated one itself, and `webViews.json` bounds the modifier mask a key event sends at 15.
A tool's calls go only to the view of the page its session is bound to, in that session's workspace, as [ARCHITECTURE.md](ARCHITECTURE.md#registration) says.

| Domain | Declared in `webViews.json` | Not declared, and why |
|---|---|---|
| Page | `enable`, `getFrameTree`, `getNavigationHistory`, which gives the URL back or forward goes to, `getLayoutMetrics`, `captureScreenshot` with its area and size bounded, and `createIsolatedWorld` only as [page changes](#page-changes) make it | `setLifecycleEventsEnabled`, `handleJavaScriptDialog` and `stopLoading`: no tool sends them. `navigate`, `navigateToHistoryEntry`, `resetNavigationHistory` and `reload`: navigation goes through the bridge, where the origin check runs, and `navigate` also takes `javascript:` and `data:` URLs. `setDocumentContent`: shows the agent's markup under the page's origin. `addScriptToEvaluateOnNewDocument`: runs script in the page. `createIsolatedWorld` with another name or with universal access: only page changes make a world. `setBypassCSP`: removes the page's own protection. `setDownloadBehavior`: writes files. `setInterceptFileChooserDialog`: no uploads in the preview. `setRPHRegistrationMode` and `setSPCTransactionMode`: accept the page's prompts without the person. `getResourceContent`, `searchInResource`, `captureSnapshot`, `printToPDF` and `startScreencast`: read beyond what the tools return. `close`, `crash`, `setWebLifecycleState` and `setPrerenderingAllowed`: the base owns the view's lifetime. |
| Runtime | `enable`, `disable`, `discardConsoleEntries`, `callFunctionOn` only with the page changes' function, and `addBinding` only with the page changes' one binding in their world, as [page changes](#page-changes) says | `evaluate`, `compileScript`, `runScript`, `awaitPromise`, and `callFunctionOn` with any other function or on an object: run the agent's script in the page, which no tool in the preview needs. The view's isolation protects the app, not the page's own data: script reads cookies, storage and typed passwords into the agent's context and can `fetch()` them to any origin, which no navigation check sees. `getProperties`, `queryObjects` and `globalLexicalScopeNames`: read the page's objects. `addBinding` with another name or in another world: opens a channel from the page's own script to the module. `terminateExecution` and `setCustomObjectFormatterEnabled`: not needed. |
| DOM | `getDocument`, `describeNode`, `getContentQuads`, `scrollIntoViewIfNeeded`, `focus`, `getNodeForLocation` | `getBoxModel`, `querySelector` and `querySelectorAll`: the tools find elements through the accessibility tree and content quads. `setFileInputFiles` and `getFileInfo`: reach local files. `setOuterHTML`, `setAttributeValue`, `setAttributesAsText`, `setNodeValue`, `setNodeName`, `removeNode`, `moveTo`, `copyTo`, `undo`, `redo` and `markUndoableState`: change the page other than by input the person can see. `resolveNode`: returns a script object, a path to running script. `getOuterHTML`: returns raw markup, with hidden fields' values and tokens. `setNodeStackTracesEnabled`: not needed. |
| Emulation | `setDeviceMetricsOverride` at one set size only, 1280 by 800, and `clearDeviceMetricsOverride` for a click on a view with no size and a screenshot of a hidden view; each only until that press or capture ends | Every other method, `setFocusEmulationEnabled` among them, which Noldova Desktop holds for an agent's press itself: user agent, touch, location, timezone and script control change what a page or the person is told. |
| Input | `dispatchMouseEvent`, `dispatchKeyEvent`, `insertText` | `dispatchDragEvent` and `setInterceptDrags`: drag data can carry local file paths. `setIgnoreInputEvents`: locks the person out of the page. |
| Accessibility | `getFullAXTree` one level deep, `getPartialAXTree` for one node without its relatives | Every other method: the tools read the tree only through these two. |
| Log | `enable` | `disable` and `clear`: the console tool keeps its own buffer. |
| Target, Browser, Network, Storage, Fetch and every other domain | None | Target opens and attaches to other pages. Browser controls the whole browser, its downloads and its permissions. Network, Storage and Fetch read and change cookies, storage, headers and request bodies, and intercept requests. Every other domain isn't needed. |

The declared events are the Page events `loadEventFired` and `frameNavigated`, the Runtime events `consoleAPICalled`, `exceptionThrown`, `executionContextCreated`, `executionContextDestroyed`, `executionContextsCleared` and `bindingCalled`, and the Log event `entryAdded`.

### Page changes

While a call's card asks, the runtime part keeps the teammate's mark on the call's element by reading the element again whenever the page reports a change, and `browser_wait_for` reads its text or element again only then; this is a risky change of the calls on the view.
It adds the binding `noldovaBrowserChanged` with `Runtime.addBinding`, for the contexts named `noldova-browser-changes` only, asks for that isolated world in each of the page's frames with `Page.createIsolatedWorld`, without universal access, and runs one function in each world's context with `Runtime.callFunctionOn`, by value and silent, by its unique id.
The call names its context only by `uniqueContextId`, which `webViews.json` requires in place of the engine's number for it: the engine numbers contexts again in each process, so a number could pass, in a navigation to another site between the world's reply and the call, to a context of the new document, such as the page's own, while a unique id names one context only, and a call by an id its document took with it fails.
One Runtime tracker for each view owns the domain for the console and the page changes: it hears the view's contexts first, then sends `Runtime.disable` and `Runtime.enable` once, since the engine reports the contexts it holds only to an enable that finds the domain off, as a domain the runtime part left on before a restart would not be; `Runtime.disable` reaches nothing new, as it only turns the domain off for the module's own session.
`webViews.json` pins the binding's name and world, the world's name and its lack of universal access, and the function, which is the protocol's `PageChangeScript` text, so Noldova Desktop's host refuses any other binding, world or function.
The function takes only true or false, to start or stop hearing the page; while heard, a scroll, a resize, a pinch zoom, a change to the document, a loaded image or font and an ended transition or animation each call the binding once a frame at most, with an empty payload, which the view forwards as `Runtime.bindingCalled`.
The binding is only in the module's own world, so the page's script can't call it, and even a report the page caused, such as by changing its document, carries no data: the runtime part only reads the element or the wait's text again with the read calls the view already allows, at most one read at a time and one each 100 ms, and publishes only a box that moved.
A `Runtime.disable` removes the binding, so while the page is heard the view's Runtime tracker keeps the binding and adds it again after each of its starts, as when another use restarted the tracker; it stops each frame's function when the card is answered, the wait ends or the call ends, with time of its own, and a frame whose world it can't make is left out.

### Agent input and the app's shortcuts

The base forwards the app's shortcuts from the view to the window, so the person's keys still reach the app while the page has focus.
An agent's key events reach the same path, so the base's main process refuses any `Input.dispatchKeyEvent` through the relay whose keys match one of the app's shortcuts, with its typed refusal.
`Input.insertText` commits text without a key event, so it never reaches the shortcuts.
Only the person's own keys are forwarded.
The same holds for the pane's keys that `webViews.json` declares, reload, a new page and the address field: the base judges only the person's presses, so an agent's `Input.dispatchKeyEvent` reaches the page as sent and never reloads it, opens a page or moves the focus to the field.
Turning the forwarding off while an agent's call runs is no substitute, since it races with the person's typing.

### Cross-origin frames

Content in a cross-origin frame belongs to another target, so the agent can't read it or act on it by reference.
A mouse event at a point still reaches it.

## Risk and permission

The setting Let agents use the browser, `browser.agentTools`, turns every tool off for agents: while it's off, the tool host refuses each call as `Unavailable` with `browser.toolsOff` before the tool classifies its action, raises a request or reaches the view. The module reads it as each call starts and never writes it, so only the person changes it, in Settings; a call already running when it turns off goes on to its end, and the person stops it as any call, by stopping agent control.

The module raises its own permission request through Noldova Desktop's permission contract, `call.requestPermissionAsync`, on the tool call, so the agent session and the scope come from the call and neither the module nor the agent names them.
An app that serves the module's tools lets them through without a prompt of its own, so the person is asked once, by the module.
Each request names the action, `browser.<name>`, its subject, its exact details and its risk level.

A request's subject is the page's origin, which Noldova Desktop keeps an answer by, and its card says what the agent is about to touch and where, with no Origin row, since the title and Page already name the site:

- **Title:** the element by its accessible name and the site by its host, such as `Click "Choose Team" on docs.example.com`, `Type into the Password field on docs.example.com` or `Press Escape on docs.example.com`; an element with no name is named by its role, `Click the checkbox on docs.example.com`, and one with no role of its own as an element.
  A click, an Enter or a key that submits a form names the form instead, `Submit the form "Create your Team account"`, by its `aria-labelledby` elements' text, its `aria-label` or its `title`, or `Submit a form on docs.example.com` when it has none.
  A navigation names the host: `Open a page on docs.example.com` within the workspace's sites, and `Open status.example.net` for a new one.
  Every title is one line, and one over 200 characters is cut with an ellipsis.
- **Page:** the page's title and URL, for a click, typing or a key.
- **Button, Link, Field or Element:** the element's name and its role, such as `"Password", textbox`, with Goes to and the address a link leads to; an element the browser can't read, such as one in another site's frame, is an Element that says so.
- **Key:** the key and its modifiers, for a key.
- **Text:** the text the agent types, shown as the agent's words; on a high-risk request, such as one into a secret field, only its length, such as "10 characters, hidden", so the text never reaches the card, and Then says that Enter submits.
- **Sends:** for a click, an Enter or a key that submits a form, the names of the fields the form sends, its buttons left out.
- **From and To:** for a navigation, the page's URL and the URL it goes to.

The names, the page's title and the form's name are the page's own and may say anything, while the roles, the host and the URLs are what the browser reads; each item over 2,000 characters is cut with an ellipsis.

Each tool that may change the page classifies its action before it acts, and every call of it raises exactly one request with that risk level.
A read-only tool whose maximum risk is Low, which only reads the page, raises none: Noldova Desktop runs its call without one and refuses any request it raises.
A low-risk request says that it doesn't ask the person, and the app's policy decides whether it does.
A click is classified by the topmost element at its point, which `DOM.getNodeForLocation` finds, not by the referenced element alone, so an element laid over the referenced one is what the click is judged by.
A medium or high action asks the person as the table says.
Only a navigation within the allowed origins is a low-risk action: every click, and all typing and every key outside a secret field, is at least medium.
A page's script can make any of them submit or send, and text the page plants could otherwise lead the agent to act with no card for the person to see.
A high-risk request has an action of its own, the tool's action with `Secret` after it, such as `browser.typeSecret`, so an answer the person kept for the tool's medium-risk calls never decides it.
A click, typing or key reads its element's risk again right before each action: typing after it focuses the field, a click before each press, a key before it sends, and typing that submits reads the form again before its Enter.
If the page made the element a secret field, or gave the form it would submit a secret field, while the card waited or in a handler of the focus, scroll, move or an earlier press, the risk has risen to high, so the action isn't sent, the call ends with `browser.riskRose`, or `browser.notSubmitted` when only the Enter was held back, and the agent's next call asks at high risk.
Only the round trip between that read and the action is left for a page's script to change the element in.
A click in a field that turned secret keeps going, since a click in a secret field is medium risk.
Whether a low-risk action asks is the app's policy: an app may ask, and offer to allow that tool's low-risk actions for the rest of the conversation.
Which calls on the view a tool uses to classify an action is in [ARCHITECTURE.md](ARCHITECTURE.md#tools).

| Action | Risk | Asks the person | "Always" remembers |
|---|---|---|---|
| Navigate, go back or forward, or reload within the allowed origins | Low | As the app's policy for low risk decides | What the app's policy offers |
| Navigate outside the allowed origins | Medium | Yes, before anything loads, naming the exact origin, which is new to this workspace, since an origin it allows doesn't ask; the options are always allow, labelled "Allow this site for the workspace", deny and always deny, with no allow once, since on allow the origin joins the workspace's origins for good | That exact origin's refusal |
| Be redirected out of the allowed origins | Refused | **Not yet:** no; Noldova Desktop refuses the redirect, and nothing asks | Nothing |
| Read the page: snapshot, screenshot or console | Low | No; the tool raises no request | Nothing |
| Click anything but the submit control of a form that holds a secret field: a submit control of a form that holds none, a link or an area, any other element or plain content, and a click the tool can't classify beforehand, with no element reference, at a point, or on a node it can't resolve; the click scrolls its element into view first, and Browser has no scroll of its own | Medium | Yes, unless the person allowed this tool on this origin for the chat; the options are allow once, allow always, labelled "Allow for this chat", and deny; a download or a new window a link would open is then refused anyway | Every medium-risk call of this tool on this origin, for the chat (Noldova Desktop keeps it by action, origin and scope) |
| Type, or press any key, in a field that isn't a secret field, or with nothing focused, unless it submits a form that holds a secret field; Enter in a form field and the type tool's submit option included | Medium | Yes, unless the person allowed this tool on this origin for the chat; the options are allow once, allow always, labelled "Allow for this chat", and deny | Every medium-risk call of this tool on this origin, for the chat (Noldova Desktop keeps it by action, origin and scope) |
| Submit a form that holds a secret field: click its submit control, press Enter or Space on it, or press Enter in any of its fields, the type tool's submit option included | High | Yes, every time; the options are allow once and deny | Not offered |
| Any input into a secret field: typing, any key through press_key, Enter and the type tool's submit option included | High | Yes, every time; the options are allow once and deny, and the request's details give only the text's length; typing or any key but Enter that doesn't submit also offers take over, labelled "I'll type it myself", which focuses the field again and runs nothing | Not offered |
| Wait for text, an element or a load | Low | No; the tool raises no request | Nothing |
| Download, upload, open a new window, use a site permission, answer an authentication prompt or pass a certificate error | Refused in the preview | No | Nothing |

Reading the page is low risk because snapshots, screenshots and console reads change nothing in the page.

An origin is new to a workspace until the person has allowed it there once, by an answer or by typing an address on it.
A page may plant a new origin in a link, so a new origin joins the workspace only by the person's own answer to a request that names it exactly; the allow keeps it for good, since an origin the workspace allows no longer asks, and a deny keeps nothing.

A secret field is an `<input type="password">`, or a field whose `autocomplete` is `current-password`, `new-password`, `one-time-code` or any `cc-` value.

## Refused even with permission

No answer from the person makes the module do these:

- navigate to a scheme other than `https:`, `http:`, `about:blank` and, in a subframe, `about:srcdoc`, or load a local scheme or a URL with credentials;
- load a host that [URL policy](#url-policy) never allows;
- mark an entry as local because of a permission request's answer;
- make a call on the view outside [Calls on the view](#calls-on-the-view), including running the agent's script in the page;
- press one of the app's shortcuts through agent input;
- change the allowed origins because of a tool's arguments, the page's content or the agent's output, or add a loopback, private, link-local or unspecified origin for a typed address;
- use a view, an element reference, a console cursor or a pending request that belongs to another agent session;
- download, upload, open a new window, grant a site permission, answer an authentication prompt or pass a certificate error, in the preview;
- accept an input over its limit ([ARCHITECTURE.md](ARCHITECTURE.md#8-buffers-and-limits)).

## Results and logs

- A result that carries anything from the page, such as a snapshot, a screenshot, console entries, a title or a URL, keeps it apart from the module's own text:
  - the page's text or image is its own content item, never joined to the module's text;
  - a fixed item before it names the origin and says that the next item is page content, since clients pass content items to the model;
  - the result also carries the origin and an untrusted flag as structured fields, for clients.
- Page text can imitate the module's fixed item, so the marking lowers the risk of a page steering the agent and doesn't prevent it.
- Page text that tells the agent to act is returned as data, and nothing else happens.
- A snapshot's content carries the origin of the document it was read from: the snapshot reads the frame before and after the tree, and fails as `Stale` rather than mark one document's text with another's origin.
- Snapshots mask the values of secret fields, and permission requests give only the length of the text an agent types into one.
- Results never carry cookies, storage, request or response headers, or a secret field's value.
- Every result's structured fields, which the app reads to show the call, hold only the page's origin and path and its title and, for a click or typing, the element's role, name and whether it is a secret field, as [ARCHITECTURE.md](ARCHITECTURE.md#tools) says; never the typed text, a field's value, or the URL's user info, query or fragment.
  The title and the name are the page's own: they may repeat whatever the page shows, as its content does, so the app treats them as untrusted.
- Logs keep tool names, outcomes, counts and durations, and at most a URL's origin.
  They never keep a URL's path, query or fragment, typed text, page text, console text or images.
- A metrics override that a view still open fails to release is logged with the view's id and the failure, never page content.
- The window part's log names a failure only by its exception's name, and an ignored setting entry only by its place in the list, never the person's text or an address; a link the runtime part refused fails with only the reason, never the address.

## Failing closed

Every failure ends the tool call with an error result whose code is one of the shared codes, in PascalCase:

| Code | When |
|---|---|
| `Refused` | The input is invalid or over its limit. |
| `Denied` | The person denied the request or took the action over, or it couldn't be raised. |
| `Expired` | The request expired before the person answered. |
| `Withdrawn` | The call was aborted, for any reason, while its request waited. |
| `Cancelled` | The call was cancelled, or its session ended, before its point of no return. |
| `Stale` | The page changed after the grant, such as to another document or to a higher risk, so nothing ran; or a snapshot's page went to another document during both of its reads. |
| `TimedOut` | The call's deadline passed before its point of no return. |
| `Stopped` | The person stopped the call before its point of no return, outside the request's wait. |
| `OutcomeUncertain` | An action that can't be repeated safely ended after its input may have reached the page; the agent takes a new snapshot. |
| `TooLarge` | A reply is over its size limit. |
| `Unavailable` | The view is gone, crashed or switched off. |

The module's own failures carry its module code, `browser.<name>`, beside one of these codes.
What the module refuses even with permission fails as `Refused`, with `browser.originRefused` for an origin, scheme or address the base refuses, `browser.shortcutRefused` for agent input that matches one of the app's shortcuts, and `browser.previewRefused` for an action refused in the preview; a fault in the module fails as `Unavailable`, with its code.
The other module codes are in [ARCHITECTURE.md](ARCHITECTURE.md#errors-and-interrupted-actions).

- A permission request that can't be raised, that expires or that is withdrawn is a refusal, and nothing runs.
- When the page crashes or its partition is cleared, every pending tool call ends with an error.
- A reply or an event that doesn't have the expected shape ends the tool call with an error; the module never guesses.
- Views, element references, console cursors and pending requests belong to one agent session, and element references end at the next navigation.

## Risky changes

A change to any of these is risky in review:

- the calls allowed on the view, or the events forwarded;
- the URL schemes, the origin matching, the address checks and the request types they cover, the bridge's resolved-address check, the partition's lack of an HTTP cache, which entries are local, the service-worker refusal, the WebSocket rule, or the hosts that are never allowed;
- the view's settings, its partition or the session's default denials;
- the shortcuts forwarded from the view, or the refusal of agent input that matches them;
- the risk table, how a tool classifies an action, or which actions ask the person and what "always" remembers;
- what a typed address allows without a request, and what the runtime part refuses before it adds an origin;
- who may open a page and with which workspace, what a page's record keeps and allows, which new windows open without the person's choice, and what clearing removes;
- what a tool result returns to the agent, such as new page data, cookies, storage, headers or field values;
- file paths, downloads or uploads;
- what logs keep;
- a new tool;
- a dependency on a DevTools-protocol or browser-automation library, since the module's own code drives the view through the base.

A risky change comes with tests that drive its failure path: refused origins and schemes from [Blocked origins](#blocked-origins), calls outside the allowed list, a request naming a child target, agent input that matches an app shortcut, messages from the view, references from another session, denied permissions, downloads and new windows, secret-field masking, inputs and results over their limits, and a page whose text tells the agent to act, and typed addresses on every refused kind of host.

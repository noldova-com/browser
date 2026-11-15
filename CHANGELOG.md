# Changelog

**Scope:** What each published version of Browser's packages holds, newest first.

Each version's section is written by the pull request that changes the version, from the pull requests merged since the previous version; other pull requests don't edit this file.

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

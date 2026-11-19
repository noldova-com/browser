/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Exception, ExceptionOptions } from "@noldova/context.exceptions";
import type { WebViewNavigation } from "@noldova/desktop.protocol";
import type { IWebViewFound, IWebViewHandle, IWindowPart } from "@noldova/desktop.window";

/**
 * Why the pane didn't go to an address the person typed: the pane's or the runtime part's refusal, the protocol's `TypedAddressRefusal`
 * with the same values, or `Failed` when the runtime part's request to allow the address failed.
 */
export declare const AddressRefusal: {
  /**
   * The text isn't a web address, value `"NotAnAddress"`.
   */
  readonly NotAnAddress: "NotAnAddress";

  /**
   * The address's scheme isn't http: or https:, value `"NotWeb"`.
   */
  readonly NotWeb: "NotWeb";

  /**
   * The address is too long to open, value `"TooLong"`.
   */
  readonly TooLong: "TooLong";

  /**
   * The address holds a user name or password, value `"Credentials"`.
   */
  readonly Credentials: "Credentials";

  /**
   * The address is on this computer or its network, and Settings doesn't name its site, value `"Local"`.
   */
  readonly Local: "Local";

  /**
   * Browser never opens the address, value `"NeverAllowed"`.
   */
  readonly NeverAllowed: "NeverAllowed";

  /**
   * The runtime part's request to allow the address failed, such as when the module's storage failed, value `"Failed"`.
   */
  readonly Failed: "Failed";
};

/**
 * One of {@link AddressRefusal}'s values.
 */
export declare type AddressRefusal = (typeof AddressRefusal)[keyof typeof AddressRefusal];

/**
 * What the pane shows for its page.
 */
export declare const PaneState: {
  /**
   * Before the pane's first navigation, value `"Empty"`.
   */
  readonly Empty: "Empty";

  /**
   * While a page loads, value `"Loading"`.
   */
  readonly Loading: "Loading";

  /**
   * Once the page has loaded, value `"Loaded"`.
   */
  readonly Loaded: "Loaded";

  /**
   * The load failed, value `"Failed"`.
   */
  readonly Failed: "Failed";

  /**
   * The origin check refused the navigation, value `"Refused"`.
   */
  readonly Refused: "Refused";

  /**
   * The page's process ended, value `"Crashed"`.
   */
  readonly Crashed: "Crashed";

  /**
   * Noldova Desktop gave the pane no view, or the host closed its view, so it can show no page, value `"Unavailable"`.
   */
  readonly Unavailable: "Unavailable";
};

/**
 * One of {@link PaneState}'s values.
 */
export declare type PaneState = (typeof PaneState)[keyof typeof PaneState];

/**
 * The kinds of the events the pane follows, each the `kind` of one {@link ViewEvent}.
 */
export declare const ViewEventKind: {
  /**
   * The host closed the view, from Noldova Desktop's `Closed` event, value `"Closed"`.
   */
  readonly Closed: "Closed";

  /**
   * The page's address, title, loading or history changed, from the `State` event, value `"State"`.
   */
  readonly State: "State";

  /**
   * A load failed, from the `LoadFailed` event, value `"LoadFailed"`.
   */
  readonly LoadFailed: "LoadFailed";

  /**
   * The origin check refused a navigation, from the `NavigationRefused` event, value `"NavigationRefused"`.
   */
  readonly NavigationRefused: "NavigationRefused";

  /**
   * The page's process ended, from the `Crashed` event, value `"Crashed"`.
   */
  readonly Crashed: "Crashed";

  /**
   * A profile's data was cleared, from the `ProfileCleared` event, value `"ProfileCleared"`.
   */
  readonly ProfileCleared: "ProfileCleared";

  /**
   * The host refused something the page asked for, from the `RequestRefused` event, value `"RequestRefused"`.
   */
  readonly RequestRefused: "RequestRefused";

  /**
   * The page asked for a new window, from the `NewWindowRequested` event, value `"NewWindowRequested"`.
   */
  readonly NewWindowRequested: "NewWindowRequested";

  /**
   * The person pressed one of the pane's keys in the page, from the `Key` event, value `"Key"`.
   */
  readonly Key: "Key";

  /**
   * The view's zoom changed, from the `Zoom` event, value `"Zoom"`.
   */
  readonly Zoom: "Zoom";
};

/**
 * One of {@link ViewEventKind}'s values.
 */
export declare type ViewEventKind = (typeof ViewEventKind)[keyof typeof ViewEventKind];

/**
 * An event the host sends about a pane's page; each kind is its own class, whose `kind` names it, and each gives the pane's status after it
 * and tells the pane's {@link PaneHearing} of it.
 *
 * @remarks
 * The pane reads them from Noldova Desktop's `WebViewEvent`; it follows no other kind.
 */
export declare abstract class ViewEvent {
  /**
   * Names this event's kind among the {@link ViewEvent} classes.
   */
  public abstract readonly kind: ViewEventKind;

  /**
   * Gives the pane's status after this event, as {@link PaneStatus.apply} does.
   *
   * @param status The status before the event.
   * @returns The new status; this same status when the event changes nothing shown.
   * @example
   * ```ts
   * import { PaneStatus, type ViewEvent } from "@noldova/browser.window";
   *
   * function after(event: ViewEvent): PaneStatus {
   *   return event.applyTo(PaneStatus.empty);
   * }
   * ```
   */
  public abstract applyTo(status: PaneStatus): PaneStatus;

  /**
   * Tells the pane's hearing of this event: the listeners of its kind, or the status it changes.
   *
   * @param hearing The pane's hearing, which its {@link PaneController} keeps.
   * @example
   * ```ts
   * import type { PaneHearing, ViewEvent } from "@noldova/browser.window";
   *
   * function hear(event: ViewEvent, hearing: PaneHearing): void {
   *   event.followIn(hearing);
   * }
   * ```
   */
  public abstract followIn(hearing: PaneHearing): void;
}

/**
 * The host closed the view; it sends no more events and refuses every call.
 *
 * @remarks
 * The pane reads it from Noldova Desktop's `Closed` web view event.
 */
export declare class ViewCloseEvent extends ViewEvent {
  /**
   * Names this event's kind among the {@link ViewEvent} classes.
   */
  public readonly kind: typeof ViewEventKind.Closed;

  /**
   * Makes the event.
   *
   * @example
   * ```ts
   * import { ViewCloseEvent } from "@noldova/browser.window";
   *
   * const closed: ViewCloseEvent = new ViewCloseEvent();
   * ```
   */
  public constructor();

  /**
   * Gives {@link PaneStatus.unavailable}, whatever the status before.
   *
   * @returns {@link PaneStatus.unavailable}.
   * @example
   * ```ts
   * import { PaneStatus, ViewCloseEvent } from "@noldova/browser.window";
   *
   * const after: PaneStatus = new ViewCloseEvent().applyTo();
   * ```
   */
  public applyTo(): PaneStatus;

  /**
   * Tells the hearing to change the pane's status by this event, as {@link PaneHearing.change} does.
   *
   * @param hearing The pane's hearing.
   * @example
   * ```ts
   * import { PaneHearing, ViewCloseEvent } from "@noldova/browser.window";
   *
   * const hearing: PaneHearing = new PaneHearing(() => undefined);
   * new ViewCloseEvent().followIn(hearing);
   * ```
   */
  public followIn(hearing: PaneHearing): void;
}

/**
 * The page's process ended unexpectedly; the view stays empty until it is navigated or reloaded.
 *
 * @remarks
 * The pane reads it from Noldova Desktop's `Crashed` web view event.
 */
export declare class ViewCrashEvent extends ViewEvent {
  /**
   * Names this event's kind among the {@link ViewEvent} classes.
   */
  public readonly kind: typeof ViewEventKind.Crashed;

  /**
   * Makes the event.
   *
   * @example
   * ```ts
   * import { ViewCrashEvent } from "@noldova/browser.window";
   *
   * const crashed: ViewCrashEvent = new ViewCrashEvent();
   * ```
   */
  public constructor();

  /**
   * Gives the status of a crashed page, as {@link PaneStatus.crash} does.
   *
   * @param status The status before the event.
   * @returns The crashed status.
   * @example
   * ```ts
   * import { PaneStatus, ViewCrashEvent } from "@noldova/browser.window";
   *
   * const after: PaneStatus = new ViewCrashEvent().applyTo(PaneStatus.empty);
   * ```
   */
  public applyTo(status: PaneStatus): PaneStatus;

  /**
   * Tells the hearing to change the pane's status by this event, as {@link PaneHearing.change} does.
   *
   * @param hearing The pane's hearing.
   * @example
   * ```ts
   * import { PaneHearing, ViewCrashEvent } from "@noldova/browser.window";
   *
   * const hearing: PaneHearing = new PaneHearing(() => undefined);
   * new ViewCrashEvent().followIn(hearing);
   * ```
   */
  public followIn(hearing: PaneHearing): void;
}

/**
 * One of the pane's keys that the person pressed in the page, such as reload on Ctrl+R or F5.
 *
 * @remarks
 * The pane reads it from Noldova Desktop's `Key` web view event, which the host sends for the keys the module declares in its
 * `webViews.json`; an agent's key events never send it.
 */
export declare class ViewKeyEvent extends ViewEvent {
  /**
   * Names this event's kind among the {@link ViewEvent} classes.
   */
  public readonly kind: typeof ViewEventKind.Key;

  /**
   * The key's name in `webViews.json`: `reload`, `newPage`, `focusAddress` or `find`.
   */
  public readonly name: string;

  /**
   * Makes the event.
   *
   * @param name The key's name in `webViews.json`.
   * @example
   * ```ts
   * import { ViewKeyEvent } from "@noldova/browser.window";
   *
   * const reload: ViewKeyEvent = new ViewKeyEvent("reload");
   * ```
   */
  public constructor(name: string);

  /**
   * Gives the status unchanged: a key changes nothing shown.
   *
   * @param status The status before the event.
   * @returns This same status: the event changes nothing shown.
   * @example
   * ```ts
   * import { PaneStatus, ViewKeyEvent } from "@noldova/browser.window";
   *
   * const after: PaneStatus = new ViewKeyEvent("reload").applyTo(PaneStatus.empty);
   * ```
   */
  public applyTo(status: PaneStatus): PaneStatus;

  /**
   * Tells the hearing's key listeners of the key, as {@link PaneHearing.pressKey} does.
   *
   * @param hearing The pane's hearing.
   * @example
   * ```ts
   * import { PaneHearing, ViewKeyEvent } from "@noldova/browser.window";
   *
   * const hearing: PaneHearing = new PaneHearing(() => undefined);
   * new ViewKeyEvent("reload").followIn(hearing);
   * ```
   */
  public followIn(hearing: PaneHearing): void;
}

/**
 * The view's new zoom, which the pane's calls, the person's keys or the wheel set.
 *
 * @remarks
 * The pane reads it from Noldova Desktop's `Zoom` web view event, which only the window part gets; the view keeps its zoom across its navigations.
 */
export declare class ViewZoomEvent extends ViewEvent {
  /**
   * Names this event's kind among the {@link ViewEvent} classes.
   */
  public readonly kind: typeof ViewEventKind.Zoom;

  /**
   * The zoom as a factor, 1 for 100%, from 0.25 to 5.
   */
  public readonly factor: number;

  /**
   * Makes the event.
   *
   * @param factor The zoom as a factor, 1 for 100%.
   * @example
   * ```ts
   * import { ViewZoomEvent } from "@noldova/browser.window";
   *
   * const zoomed: ViewZoomEvent = new ViewZoomEvent(1.25);
   * ```
   */
  public constructor(factor: number);

  /**
   * Gives the status unchanged: a zoom changes nothing shown.
   *
   * @param status The status before the event.
   * @returns This same status: the event changes nothing shown.
   * @example
   * ```ts
   * import { PaneStatus, ViewZoomEvent } from "@noldova/browser.window";
   *
   * const after: PaneStatus = new ViewZoomEvent(1.25).applyTo(PaneStatus.empty);
   * ```
   */
  public applyTo(status: PaneStatus): PaneStatus;

  /**
   * Tells the hearing the view's new zoom, as {@link PaneHearing.zoomTo} does.
   *
   * @param hearing The pane's hearing.
   * @example
   * ```ts
   * import { PaneHearing, ViewZoomEvent } from "@noldova/browser.window";
   *
   * const hearing: PaneHearing = new PaneHearing(() => undefined);
   * new ViewZoomEvent(1.25).followIn(hearing);
   * ```
   */
  public followIn(hearing: PaneHearing): void;
}

/**
 * A load of the page failed.
 *
 * @remarks
 * The pane reads it from Noldova Desktop's `LoadFailed` web view event.
 */
export declare class ViewLoadFailureEvent extends ViewEvent {
  /**
   * Names this event's kind among the {@link ViewEvent} classes.
   */
  public readonly kind: typeof ViewEventKind.LoadFailed;

  /**
   * The address that failed to load.
   */
  public readonly address: string;

  /**
   * The engine's code for the failure, such as `-105`.
   */
  public readonly code: number;

  /**
   * The engine's description of the failure, such as `ERR_NAME_NOT_RESOLVED`.
   */
  public readonly description: string;

  /**
   * Makes the event.
   *
   * @param address The address that failed to load.
   * @param code The engine's code for the failure.
   * @param description The engine's description of the failure.
   * @example
   * ```ts
   * import { ViewLoadFailureEvent } from "@noldova/browser.window";
   *
   * const failed: ViewLoadFailureEvent = new ViewLoadFailureEvent("https://www.example.com/", -105, "ERR_NAME_NOT_RESOLVED");
   * ```
   */
  public constructor(address: string, code: number, description: string);

  /**
   * Gives the status of the failed load, as {@link PaneStatus.fail} does.
   *
   * @param status The status before the event.
   * @returns The failed status.
   * @example
   * ```ts
   * import { PaneStatus, ViewLoadFailureEvent } from "@noldova/browser.window";
   *
   * const after: PaneStatus = new ViewLoadFailureEvent("https://www.example.com/", -105, "ERR_NAME_NOT_RESOLVED").applyTo(PaneStatus.empty);
   * ```
   */
  public applyTo(status: PaneStatus): PaneStatus;

  /**
   * Tells the hearing of the failed load, as {@link PaneHearing.fail} does: it changes the status unless it ends a load the origin check refused.
   *
   * @param hearing The pane's hearing.
   * @example
   * ```ts
   * import { PaneHearing, ViewLoadFailureEvent } from "@noldova/browser.window";
   *
   * const hearing: PaneHearing = new PaneHearing(() => undefined);
   * new ViewLoadFailureEvent("https://www.example.com/", -105, "ERR_NAME_NOT_RESOLVED").followIn(hearing);
   * ```
   */
  public followIn(hearing: PaneHearing): void;
}

/**
 * A page asked for a new window, such as a link with `target="_blank"` or a script's `window.open`.
 *
 * @remarks
 * The pane reads it from Noldova Desktop's `NewWindowRequested` web view event, which the module takes because its `webViews.json` says
 * `"newWindows": true`.
 */
export declare class ViewNewWindowEvent extends ViewEvent {
  /**
   * Names this event's kind among the {@link ViewEvent} classes.
   */
  public readonly kind: typeof ViewEventKind.NewWindowRequested;

  /**
   * The address the page asked for, resolved against the page.
   */
  public readonly address: string;

  /**
   * Whether the person's own key, mouse button or touch reached the view in the last 5 seconds, as the host judges it.
   */
  public readonly hadRecentInput: boolean;

  /**
   * The origin of the referrer the engine would send, or `null` when it sends none.
   */
  public readonly origin: string | null;

  /**
   * Whether the engine asked for a background tab, its disposition `background-tab`, as for a middle or Ctrl click on a link, or Cmd
   * click on macOS; false for a script's `window.open`, a link's `target="_blank"` and an event without a disposition.
   */
  public readonly isBackgroundTab: boolean;

  /**
   * Makes the event.
   *
   * @param address The address the page asked for.
   * @param hadRecentInput Whether the person's own input reached the view in the last 5 seconds.
   * @param origin The origin of the referrer, or `null`.
   * @param isBackgroundTab Whether the engine asked for a background tab; false when left out.
   * @example
   * ```ts
   * import { ViewNewWindowEvent } from "@noldova/browser.window";
   *
   * const asked: ViewNewWindowEvent = new ViewNewWindowEvent("https://www.example.com/", true, "https://docs.example.com");
   * ```
   */
  public constructor(address: string, hadRecentInput: boolean, origin: string | null, isBackgroundTab?: boolean);

  /**
   * Gives the status unchanged: the pane offers a new window only through {@link PaneController.offerPopup}.
   *
   * @param status The status before the event.
   * @returns This same status: the event changes nothing shown.
   * @example
   * ```ts
   * import { PaneStatus, ViewNewWindowEvent } from "@noldova/browser.window";
   *
   * const after: PaneStatus = new ViewNewWindowEvent("https://www.example.com/", true, "https://docs.example.com").applyTo(PaneStatus.empty);
   * ```
   */
  public applyTo(status: PaneStatus): PaneStatus;

  /**
   * Tells the hearing's new-window listeners of the request, as {@link PaneHearing.openWindow} does.
   *
   * @param hearing The pane's hearing.
   * @example
   * ```ts
   * import { PaneHearing, ViewNewWindowEvent } from "@noldova/browser.window";
   *
   * const hearing: PaneHearing = new PaneHearing(() => undefined);
   * new ViewNewWindowEvent("https://www.example.com/", true, "https://docs.example.com").followIn(hearing);
   * ```
   */
  public followIn(hearing: PaneHearing): void;
}

/**
 * The view's profile was cleared of its cookies, storage and cache, and the view's pending calls ended.
 *
 * @remarks
 * The pane reads it from Noldova Desktop's `ProfileCleared` web view event.
 */
export declare class ViewProfileClearedEvent extends ViewEvent {
  /**
   * Names this event's kind among the {@link ViewEvent} classes.
   */
  public readonly kind: typeof ViewEventKind.ProfileCleared;

  /**
   * The key of the profile that was cleared.
   */
  public readonly profileKey: string;

  /**
   * Makes the event.
   *
   * @param profileKey The key of the profile that was cleared.
   * @example
   * ```ts
   * import { ViewProfileClearedEvent } from "@noldova/browser.window";
   *
   * const cleared: ViewProfileClearedEvent = new ViewProfileClearedEvent("workspace-1");
   * ```
   */
  public constructor(profileKey: string);

  /**
   * Gives the status unchanged: a cleared profile changes nothing shown.
   *
   * @param status The status before the event.
   * @returns This same status: the event changes nothing shown.
   * @example
   * ```ts
   * import { PaneStatus, ViewProfileClearedEvent } from "@noldova/browser.window";
   *
   * const after: PaneStatus = new ViewProfileClearedEvent("workspace-1").applyTo(PaneStatus.empty);
   * ```
   */
  public applyTo(status: PaneStatus): PaneStatus;

  /**
   * Tells the hearing to change the pane's status by this event, as {@link PaneHearing.change} does.
   *
   * @param hearing The pane's hearing.
   * @example
   * ```ts
   * import { PaneHearing, ViewProfileClearedEvent } from "@noldova/browser.window";
   *
   * const hearing: PaneHearing = new PaneHearing(() => undefined);
   * new ViewProfileClearedEvent("workspace-1").followIn(hearing);
   * ```
   */
  public followIn(hearing: PaneHearing): void;
}

/**
 * The origin check refused a navigation of the page, such as a link or a redirect; the page stays where it was.
 *
 * @remarks
 * The pane reads it from Noldova Desktop's `NavigationRefused` web view event.
 */
export declare class ViewRefusalEvent extends ViewEvent {
  /**
   * Names this event's kind among the {@link ViewEvent} classes.
   */
  public readonly kind: typeof ViewEventKind.NavigationRefused;

  /**
   * The address the check refused.
   */
  public readonly address: string;

  /**
   * The address's origin, as the URL standard writes it.
   */
  public readonly origin: string;

  /**
   * Whether a redirect led to the address.
   */
  public readonly isRedirect: boolean;

  /**
   * Makes the event.
   *
   * @param address The address the check refused.
   * @param origin The address's origin, as the URL standard writes it.
   * @param isRedirect Whether a redirect led to the address.
   * @example
   * ```ts
   * import { ViewRefusalEvent } from "@noldova/browser.window";
   *
   * const refused: ViewRefusalEvent = new ViewRefusalEvent("https://www.example.com/", "https://www.example.com", false);
   * ```
   */
  public constructor(address: string, origin: string, isRedirect: boolean);

  /**
   * Gives the status with this origin refused, as {@link PaneStatus.refuse} does; when the pane isn't loading, the refusal holds the page's load.
   *
   * @param status The status before the event.
   * @returns The refused status; this same status when it was already refused for that origin and held the same load.
   * @example
   * ```ts
   * import { PaneStatus, ViewRefusalEvent } from "@noldova/browser.window";
   *
   * const after: PaneStatus = new ViewRefusalEvent("https://www.example.com/", "https://www.example.com", false).applyTo(PaneStatus.empty);
   * ```
   */
  public applyTo(status: PaneStatus): PaneStatus;

  /**
   * Tells the hearing of the refusal, as {@link PaneHearing.refuse} does: a refused redirect asks the redirect listeners first.
   *
   * @param hearing The pane's hearing.
   * @example
   * ```ts
   * import { PaneHearing, ViewRefusalEvent } from "@noldova/browser.window";
   *
   * const hearing: PaneHearing = new PaneHearing(() => undefined);
   * new ViewRefusalEvent("https://www.example.com/", "https://www.example.com", false).followIn(hearing);
   * ```
   */
  public followIn(hearing: PaneHearing): void;
}

/**
 * The host refused something the page asked for, such as a download or a new window, without asking anyone.
 *
 * @remarks
 * The pane reads it from Noldova Desktop's `RequestRefused` web view event.
 */
export declare class ViewRequestRefusalEvent extends ViewEvent {
  /**
   * Names this event's kind among the {@link ViewEvent} classes.
   */
  public readonly kind: typeof ViewEventKind.RequestRefused;

  /**
   * What the host refused.
   */
  public readonly request: RefusedRequest;

  /**
   * The origin of the page that asked, as the URL standard writes it.
   */
  public readonly origin: string;

  /**
   * Makes the event.
   *
   * @param request What the host refused.
   * @param origin The origin of the page that asked, as the URL standard writes it.
   * @example
   * ```ts
   * import { RefusedRequest, ViewRequestRefusalEvent } from "@noldova/browser.window";
   *
   * const refused: ViewRequestRefusalEvent = new ViewRequestRefusalEvent(RefusedRequest.Download, "https://www.example.com");
   * ```
   */
  public constructor(request: RefusedRequest, origin: string);

  /**
   * Gives the status with this request refused, as {@link PaneStatus.refuseRequest} does.
   *
   * @param status The status before the event.
   * @returns The new status; this same status when it already showed that request.
   * @example
   * ```ts
   * import { PaneStatus, RefusedRequest, ViewRequestRefusalEvent } from "@noldova/browser.window";
   *
   * const after: PaneStatus = new ViewRequestRefusalEvent(RefusedRequest.Download, "https://www.example.com").applyTo(PaneStatus.empty);
   * ```
   */
  public applyTo(status: PaneStatus): PaneStatus;

  /**
   * Tells the hearing to change the pane's status by this event, as {@link PaneHearing.change} does.
   *
   * @param hearing The pane's hearing.
   * @example
   * ```ts
   * import { PaneHearing, RefusedRequest, ViewRequestRefusalEvent } from "@noldova/browser.window";
   *
   * const hearing: PaneHearing = new PaneHearing(() => undefined);
   * new ViewRequestRefusalEvent(RefusedRequest.Download, "https://www.example.com").followIn(hearing);
   * ```
   */
  public followIn(hearing: PaneHearing): void;
}

/**
 * The page's address, title, loading or history changed, by a navigation, a redirect, a move through the history or a stop.
 *
 * @remarks
 * The pane reads it from Noldova Desktop's `State` web view event.
 * The host sends it whenever any of its values changes.
 */
export declare class ViewStateEvent extends ViewEvent {
  /**
   * Names this event's kind among the {@link ViewEvent} classes.
   */
  public readonly kind: typeof ViewEventKind.State;

  /**
   * The page's address as the engine reports it; empty before the first load.
   */
  public readonly address: string;

  /**
   * The page's title, which is the page's own text and untrusted; empty when it has none.
   */
  public readonly title: string;

  /**
   * Whether the page is loading.
   */
  public readonly isLoading: boolean;

  /**
   * Whether the history has an entry to go back to.
   */
  public readonly canGoBack: boolean;

  /**
   * Whether the history has an entry to go forward to.
   */
  public readonly canGoForward: boolean;

  /**
   * Makes the event.
   *
   * @param address The page's address; empty before the first load.
   * @param title The page's title; empty when it has none.
   * @param isLoading Whether the page is loading.
   * @param canGoBack Whether the history has an entry to go back to.
   * @param canGoForward Whether the history has an entry to go forward to.
   * @example
   * ```ts
   * import { ViewStateEvent } from "@noldova/browser.window";
   *
   * const loaded: ViewStateEvent = new ViewStateEvent("https://www.example.com/", "Example", false, true, false);
   * ```
   */
  public constructor(address: string, title: string, isLoading: boolean, canGoBack: boolean, canGoForward: boolean);

  /**
   * Gives the status the page's state shows, as {@link PaneStatus.show} does.
   *
   * @param status The status before the event.
   * @returns The new status.
   * @example
   * ```ts
   * import { PaneStatus, ViewStateEvent } from "@noldova/browser.window";
   *
   * const after: PaneStatus = new ViewStateEvent("https://www.example.com/", "Example", false, true, false).applyTo(PaneStatus.empty);
   * ```
   */
  public applyTo(status: PaneStatus): PaneStatus;

  /**
   * Tells the hearing of the page's state, as {@link PaneHearing.show} does.
   *
   * @param hearing The pane's hearing.
   * @example
   * ```ts
   * import { PaneHearing, ViewStateEvent } from "@noldova/browser.window";
   *
   * const hearing: PaneHearing = new PaneHearing(() => undefined);
   * new ViewStateEvent("https://www.example.com/", "Example", false, true, false).followIn(hearing);
   * ```
   */
  public followIn(hearing: PaneHearing): void;
}

/**
 * What the host refuses for a page without asking anyone.
 *
 * @remarks
 * The kinds of Noldova Desktop's `RequestRefused` web view event, as the pane reads them by the names that event writes.
 */
export declare const RefusedRequest: {
  /**
   * A download, which Noldova Desktop's `RequestRefused` event names `download`; value `"Download"`.
   */
  readonly Download: "Download";

  /**
   * A new window, named `newWindow`; value `"NewWindow"`.
   */
  readonly NewWindow: "NewWindow";

  /**
   * A site permission, such as the camera or the location, named `permission`; value `"Permission"`.
   */
  readonly Permission: "Permission";

  /**
   * A file from this computer, named `fileChooser`; value `"FileChooser"`.
   */
  readonly FileChooser: "FileChooser";

  /**
   * A sign-in dialog, named `authentication`; value `"Authentication"`.
   */
  readonly Authentication: "Authentication";

  /**
   * A certificate the host didn't accept, named `certificate`; value `"Certificate"`.
   */
  readonly Certificate: "Certificate";

  /**
   * A page shown inside another page, named `nestedView`; value `"NestedView"`.
   */
  readonly NestedView: "NestedView";
};

/**
 * One of {@link RefusedRequest}'s values.
 */
export declare type RefusedRequest = (typeof RefusedRequest)[keyof typeof RefusedRequest];

/**
 * A new window a page asked for without the person's own input, which the tab's notice offers to open as a tab.
 */
export declare class PopupOffer {
  /**
   * The address the page asked for.
   */
  public readonly address: string;

  /**
   * The origin of the referrer, or `null` when the engine sends none.
   */
  public readonly origin: string | null;

  /**
   * Whether the person's own input came just before: true when the tab had already opened a new page for that input, so the notice
   * says this window waits rather than that a pop-up was stopped.
   */
  public readonly hadRecentInput: boolean;

  /**
   * Makes the offer.
   *
   * @param address The address the page asked for.
   * @param origin The origin of the referrer, or `null`.
   * @param hadRecentInput Whether the person's own input came just before.
   * @example
   * ```ts
   * import { PopupOffer } from "@noldova/browser.window";
   *
   * const offer: PopupOffer = new PopupOffer("https://www.example.com/", "https://docs.example.com", false);
   * ```
   */
  public constructor(address: string, origin: string | null, hadRecentInput: boolean);
}

/**
 * The states the pane can show.
 */
export declare class PaneStates {
  /**
   * Every pane state, each once.
   *
   * @example
   * ```ts
   * import { PaneStates } from "@noldova/browser.window";
   *
   * const count: number = PaneStates.all.length;
   * ```
   */
  public static readonly all: readonly PaneState[];

  /**
   * Tells whether a value, such as one a message carries, is a pane state.
   *
   * @param value The value to look up; it matches only exactly, case included.
   * @returns `true` when `value` is one of {@link PaneStates.all}, which narrows it to {@link PaneState}; `false` otherwise.
   * @example
   * ```ts
   * import { PaneStates } from "@noldova/browser.window";
   *
   * PaneStates.includes("Crashed");
   * PaneStates.includes("Closed");
   * ```
   */
  public static includes(value: string): value is PaneState;
}

/**
 * What the pane shows at one moment: its state, the page's address and title, where the history allows going, and any problem.
 * A value never changes; each event gives a new one.
 */
export declare class PaneStatus {
  /**
   * The status before the first navigation: `Empty`, with no address, title, history or problem.
   *
   * @example
   * ```ts
   * import { PaneState, PaneStatus } from "@noldova/browser.window";
   *
   * const isEmpty: boolean = PaneStatus.empty.state === PaneState.Empty;
   * ```
   */
  public static readonly empty: PaneStatus;

  /**
   * The status of a pane Noldova Desktop gave no view, or whose view the host closed: `Unavailable`, with no address, title, history or problem.
   *
   * @example
   * ```ts
   * import { PaneState, PaneStatus } from "@noldova/browser.window";
   *
   * const isUnavailable: boolean = PaneStatus.unavailable.state === PaneState.Unavailable;
   * ```
   */
  public static readonly unavailable: PaneStatus;

  /**
   * What the pane shows for its page.
   */
  public readonly state: PaneState;

  /**
   * The address to show, read-only: the page's address as the engine reports it, or after a failed load the address that failed; empty before the first navigation.
   */
  public readonly url: string;

  /**
   * The page's title, which is the page's own text and untrusted; empty when it has none.
   */
  public readonly title: string;

  /**
   * Whether going back is possible.
   */
  public readonly canGoBack: boolean;

  /**
   * Whether going forward is possible.
   */
  public readonly canGoForward: boolean;

  /**
   * Why the load failed, as the engine describes it, such as `ERR_NAME_NOT_RESOLVED`, while the state is `Failed`; `null` otherwise.
   */
  public readonly failureReason: string | null;

  /**
   * The origin of the address the check refused, as the URL standard writes it, or that address itself when its origin is opaque, which the
   * standard writes as `"null"`, such as `about:srcdoc`'s, while the state is `Refused`; `null` otherwise.
   */
  public readonly refusedOrigin: string | null;

  /**
   * What the page last asked for that the host refused, such as a download, until the next load starts or the person dismisses it; `null` otherwise.
   */
  public readonly refusedRequest: RefusedRequest | null;

  /**
   * The address a refused request was for, such as a new window's that didn't open, which the notice opens in the system's browser in place of the page's own; `null` otherwise.
   */
  public readonly refusedTarget: string | null;

  /**
   * Why the pane didn't go to an address the person typed, until a load starts, a load fails, the origin check refuses a navigation, the page asks for something the host refuses, or the person dismisses it; `null` otherwise.
   * At most one of it and {@link PaneStatus.refusedRequest} is set: the latest takes the other's place.
   */
  public readonly refusedAddress: AddressRefusal | null;

  /**
   * A new window the page asked for without the person's own input, until a load starts, the page asks for something the host refuses,
   * the pane refuses a typed address or the person opens or dismisses it; `null` otherwise.
   * At most one of it, {@link PaneStatus.refusedRequest} and {@link PaneStatus.refusedAddress} is set: the latest takes the others' place.
   */
  public readonly popup: PopupOffer | null;

  private constructor();

  /**
   * Gives the status after one of the page's events.
   *
   * @param event The event, as the pane reads it from Noldova Desktop's web view.
   * @returns The new status; this same status when the event changes nothing shown.
   * A `State` event gives its address, title and history; while loading it gives `Loading` and clears a failure, a refusal or a crash, unless a refusal holds the load, and once loading stops
   * it turns `Loading` into `Loaded` and keeps any other state.
   * A `NavigationRefused` event refuses its origin, and when the pane isn't loading it holds the page's load: a loading `State` event at the page's address then keeps `Refused`
   * and the refused origin, so the load start and stop the view may still report show the refusal. The next `State` event ends the hold, and so does {@link PaneStatus.navigate}.
   * A refused request is kept in {@link PaneStatus.refusedRequest}, replacing the one before and any refused address, until a load starts or a load fails; a cleared profile changes nothing shown.
   * @example
   * ```ts
   * import { PaneStatus, ViewStateEvent } from "@noldova/browser.window";
   *
   * const loading: PaneStatus = PaneStatus.empty.apply(new ViewStateEvent("https://example.com/", "", true, false, false));
   * ```
   */
  public apply(event: ViewEvent): PaneStatus;

  /**
   * Gives the status after the page's state: its address, title and history; while loading it gives `Loading` and clears a failure, a refusal or a crash,
   * unless a refusal holds the load at the page's address, and once loading stops it turns `Loading` into `Loaded` and keeps any other state.
   * A refused request that came while `Loading` stays through the rest of that load; a load that starts after it clears it.
   *
   * @param state The page's state.
   * @returns The new status.
   * @example
   * ```ts
   * import { PaneStatus, ViewStateEvent } from "@noldova/browser.window";
   *
   * const loading: PaneStatus = PaneStatus.empty.show(new ViewStateEvent("https://example.com/", "", true, false, false));
   * ```
   */
  public show(state: ViewStateEvent): PaneStatus;

  /**
   * Gives the status after a load failed: `Failed`, with the failed address and the failure's description, and no refusal or pop-up, except a refused
   * request that came while that load was `Loading`.
   *
   * @param failure The failed load.
   * @returns The new status.
   * @example
   * ```ts
   * import { PaneStatus, ViewLoadFailureEvent } from "@noldova/browser.window";
   *
   * const failed: PaneStatus = PaneStatus.empty.fail(new ViewLoadFailureEvent("https://example.com/", -105, "ERR_NAME_NOT_RESOLVED"));
   * ```
   */
  public fail(failure: ViewLoadFailureEvent): PaneStatus;

  /**
   * Gives the status after the page's process ended: `Crashed`, with the page's address, title and history, and any refused request, refused address or pop-up kept.
   *
   * @returns The new status.
   * @example
   * ```ts
   * import { PaneStatus } from "@noldova/browser.window";
   *
   * const crashed: PaneStatus = PaneStatus.empty.crash();
   * ```
   */
  public crash(): PaneStatus;

  /**
   * Gives the status after the origin check refused an address, such as in a navigation's answer, with the page's address, title and history kept.
   *
   * @param origin The refused address's origin, as the URL standard writes it.
   * @param holdsRefusedLoad Whether the refusal holds the page's load that the view may still report after it, at the page's address, so that load
   * shows the refusal until the view's next state; `false`, the default, for a refusal that answers a navigation, which has no load to hold.
   * @param address The refused address, which the status names in place of an opaque origin, `"null"`; `null`, the default, names the origin as given.
   * @returns The new status, with no refused address; this same status when it was already refused for that origin, had no refused address
   * and held the same load.
   * @example
   * ```ts
   * import { PaneStatus } from "@noldova/browser.window";
   *
   * const refused: PaneStatus = PaneStatus.empty.refuse("https://example.com");
   * const holding: PaneStatus = PaneStatus.empty.refuse("https://example.com", true);
   * const srcdoc: PaneStatus = PaneStatus.empty.refuse("null", true, "about:srcdoc");
   * ```
   */
  public refuse(origin: string, holdsRefusedLoad?: boolean, address?: string | null): PaneStatus;

  /**
   * Gives the status once the person or an agent started a navigation, which is new, so a refusal holds none of its loads and a refused request's notice goes.
   *
   * @returns The new status, which holds no load and has no refused request; this same status when it held none and had none.
   * @example
   * ```ts
   * import { PaneStatus } from "@noldova/browser.window";
   *
   * const navigating: PaneStatus = PaneStatus.empty.refuse("https://example.com", true).navigate();
   * ```
   */
  public navigate(): PaneStatus;

  /**
   * Gives the status after the pane didn't go to an address the person typed, with the page, its state and its history kept.
   *
   * @param reason Why the address was refused, by the pane itself or by the runtime part, or `Failed` when the runtime part's request failed.
   * @param origin The refused address's origin, when the runtime part refused its site; `null`, the default, for text that names no site.
   * Over a `Failed` or `Refused` state, an origin gives a `Refused` state of its own, which dismissing the address's notice takes back, so the
   * page never names two addresses.
   * @returns The new status, with this reason in place of any refused request; this same status when it already had this reason, and this origin.
   * @example
   * ```ts
   * import { TypedAddressRefusal } from "@noldova/browser.protocol";
   * import { PaneStatus } from "@noldova/browser.window";
   *
   * const refused: PaneStatus = PaneStatus.empty.refuseAddress(TypedAddressRefusal.NotAnAddress);
   * const local: PaneStatus = PaneStatus.empty.refuseAddress(TypedAddressRefusal.Local, "http://192.168.1.20");
   * ```
   */
  public refuseAddress(reason: AddressRefusal, origin?: string | null): PaneStatus;

  /**
   * Gives the status once the person dismissed or opened the notice of a refused request or a pop-up, with everything else kept.
   *
   * @returns The new status, with no refused request or pop-up; this same status when it had neither.
   * @example
   * ```ts
   * import { PaneStatus } from "@noldova/browser.window";
   *
   * const quiet: PaneStatus = PaneStatus.empty.dismissRequest();
   * ```
   */
  public dismissRequest(): PaneStatus;

  /**
   * Gives the status once the person dismissed the notice of a refused address, or put the page's address back in the field, with everything else kept.
   *
   * @returns The new status, with no refused address; this same status when it had none.
   * @example
   * ```ts
   * import { TypedAddressRefusal } from "@noldova/browser.protocol";
   * import { PaneStatus } from "@noldova/browser.window";
   *
   * const quiet: PaneStatus = PaneStatus.empty.refuseAddress(TypedAddressRefusal.NotWeb).dismissAddress();
   * ```
   */
  public dismissAddress(): PaneStatus;

  /**
   * Gives the status with the notice of a new window the page asked for that didn't open by itself, in place of any other notice.
   *
   * @param popup The address the page asked for, the origin that asked, and whether the person's input came just before.
   * @returns The new status.
   * @example
   * ```ts
   * import { PaneStatus, PopupOffer } from "@noldova/browser.window";
   *
   * const offered: PaneStatus = PaneStatus.empty.offerPopup(new PopupOffer("https://example.com/", null, false));
   * ```
   */
  public offerPopup(popup: PopupOffer): PaneStatus;

  /**
   * Gives the status with the notice of a request of the page that got nothing, in place of a typed address's or a pop-up's notice.
   *
   * @param request The request that got nothing.
   * @param target The address the request was for, such as the new window's; `null`, the default, for the page's own.
   * @returns The new status, or this one when its notice already names that request and address.
   * @example
   * ```ts
   * import { PaneStatus, RefusedRequest } from "@noldova/browser.window";
   *
   * const refused: PaneStatus = PaneStatus.empty.refuseRequest(RefusedRequest.NewWindow, "https://example.com/");
   * ```
   */
  public refuseRequest(request: RefusedRequest, target?: string | null): PaneStatus;
}

/**
 * The base of every exception Browser's window part throws, so an app can catch them as one kind.
 *
 * @example
 * ```ts
 * import { BrowserWindowException, PaneUnavailableException } from "@noldova/browser.window";
 *
 * console.log(new PaneUnavailableException() instanceof BrowserWindowException);
 * ```
 */
export declare abstract class BrowserWindowException extends Exception {
  /**
   * Makes the exception with its message, and the failure that caused it, if any.
   *
   * @param message What failed, from the window part's resources.
   * @param options The cause, as context's exception options carry it.
   */
  protected constructor(message: string, options?: ExceptionOptions);
}

/**
 * Thrown when a pane Noldova Desktop gave no view, or whose view the host closed, is asked to navigate, move through its history, reload or stop.
 */
export declare class PaneUnavailableException extends BrowserWindowException {
  /**
   * `PaneUnavailableException`.
   */
  public override readonly name: string;

  /**
   * Makes the exception, with a message that says the pane has no embedded view, or the host closed it.
   *
   * @example
   * ```ts
   * import { PaneUnavailableException } from "@noldova/browser.window";
   *
   * function isUnavailable(error: unknown): boolean {
   *   return error instanceof PaneUnavailableException;
   * }
   * ```
   */
  public constructor();
}

/**
 * Drives one pane's page through Noldova Desktop's window bridge: it follows the page's events and answers into a {@link PaneStatus} and moves through the history; the module's own elements, such as its menu, lie over the live page.
 */
export declare class PaneController {
  /**
   * Starts following a view's events.
   *
   * @param view The pane's page, which the controller owns from now on and closes in {@link PaneController.close};
   * `null` when Noldova Desktop has no view to give, and the pane stays {@link PaneStatus.unavailable}.
   * @example
   * ```ts
   * import { QualifiedName, WebViewPane } from "@noldova/desktop.protocol";
   * import type { IWindowWebViews } from "@noldova/desktop.window";
   * import { PaneController } from "@noldova/browser.window";
   *
   * async function openAsync(webViews: IWindowWebViews): Promise<PaneController> {
   *   return new PaneController(await webViews.openAsync(new WebViewPane(QualifiedName.parse("browser.page"), crypto.randomUUID()), "workspace-1"));
   * }
   * ```
   * @example
   * ```ts
   * import { PaneController } from "@noldova/browser.window";
   *
   * const unavailable: PaneController = new PaneController(null);
   * ```
   */
  public constructor(view: IWebViewHandle | null);

  /**
   * What the pane shows now; {@link PaneStatus.empty} until the first event, or {@link PaneStatus.unavailable} with no view or once the host closed it.
   */
  public get status(): PaneStatus;

  /**
   * The view's zoom as a factor, 1 for 100%, which starts at 1 and follows the view's `Zoom` events and the zoom calls' answers.
   */
  public get zoom(): number;

  /**
   * Listens to each change of {@link PaneController.status}.
   *
   * @param listener Called with each new status, in order; it must not throw.
   * @returns A function that stops the listening; calling it again does nothing.
   * @example
   * ```ts
   * import type { PaneController, PaneStatus } from "@noldova/browser.window";
   *
   * function follow(controller: PaneController): () => void {
   *   return controller.onChange((status: PaneStatus) => console.log(status.state));
   * }
   * ```
   */
  public onChange(listener: (status: PaneStatus) => void): () => void;

  /**
   * Tells the listener of each new window the page asks for, until it stops listening or the controller closes.
   *
   * @param listener Called with each request.
   * @returns The function that stops it listening.
   * @example
   * ```ts
   * import type { PaneController, ViewNewWindowEvent } from "@noldova/browser.window";
   *
   * function follow(controller: PaneController): () => void {
   *   return controller.onNewWindow((event: ViewNewWindowEvent) => console.log(event.address));
   * }
   * ```
   */
  public onNewWindow(listener: (event: ViewNewWindowEvent) => void): () => void;

  /**
   * Tells the listener of each of the pane's keys the person presses in the page, until it stops listening or the controller closes.
   *
   * @param listener Called with each key.
   * @returns The function that stops it listening.
   * @example
   * ```ts
   * import type { PaneController, ViewKeyEvent } from "@noldova/browser.window";
   *
   * function follow(controller: PaneController): () => void {
   *   return controller.onKey((event: ViewKeyEvent) => console.log(event.name));
   * }
   * ```
   */
  public onKey(listener: (event: ViewKeyEvent) => void): () => void;

  /**
   * Tells the listener of each change of the view's zoom, by the zoom calls, the person's keys or the wheel, once each, without a change of status,
   * until it stops listening or the controller closes.
   *
   * @param listener Called with the new zoom as a factor, 1 for 100%.
   * @returns The function that stops it listening.
   * @example
   * ```ts
   * import type { PaneController } from "@noldova/browser.window";
   *
   * function follow(controller: PaneController): () => void {
   *   return controller.onZoom((factor: number) => console.log(`${String(Math.round(factor * 100))}%`));
   * }
   * ```
   */
  public onZoom(listener: (factor: number) => void): () => void;

  /**
   * Asks the listener first about each redirect the origin check refused, until it stops listening or the controller closes; a listener
   * that takes the redirect on, such as one that follows a typed address's redirects, answers true, and the status then shows no refusal for it.
   *
   * @param listener Called with each refused redirect; it answers whether it took the redirect on.
   * @returns The function that stops it listening.
   * @example
   * ```ts
   * import type { PaneController, ViewRefusalEvent } from "@noldova/browser.window";
   *
   * function follow(controller: PaneController): () => void {
   *   return controller.onRefusedRedirect((event: ViewRefusalEvent) => event.origin === "https://www.example.com");
   * }
   * ```
   */
  public onRefusedRedirect(listener: (event: ViewRefusalEvent) => boolean): () => void;

  /**
   * Tells the controller that a navigation it didn't start, such as an agent's, began on the page, which is new too, so a refusal holds
   * none of its loads; listeners hear of a change. It does nothing once the controller closed or the tab is unavailable.
   *
   * @example
   * ```ts
   * import type { PaneController } from "@noldova/browser.window";
   *
   * function followed(controller: PaneController): void {
   *   controller.followNavigation();
   * }
   * ```
   */
  public followNavigation(): void;

  /**
   * Shows the not-allowed page for an origin, such as a redirect's that the runtime part refused; listeners hear of the change.
   * It does nothing once the controller closed or the tab is unavailable.
   *
   * @param origin The refused origin, as the URL standard writes it.
   * @param address The refused address, which the page names in place of an opaque origin, `"null"`; `null`, the default, names the origin, and an
   * opaque one as "this page".
   * @example
   * ```ts
   * import type { PaneController } from "@noldova/browser.window";
   *
   * function refuse(controller: PaneController): void {
   *   controller.refuseNavigation("https://www.example.com");
   * }
   * ```
   */
  public refuseNavigation(origin: string, address?: string | null): void;

  /**
   * Offers a new window the page asked for, which didn't open by itself, in the tab's notice; listeners hear of the change.
   * It does nothing once the controller closed or the tab is unavailable.
   *
   * @param address The address the page asked for.
   * @param origin The origin that asked, or `null`.
   * @param hadRecentInput Whether the person's input came just before, as the tab had already opened a page for it; false when left out.
   * @example
   * ```ts
   * import type { PaneController } from "@noldova/browser.window";
   *
   * function offer(controller: PaneController): void {
   *   controller.offerPopup("https://example.com/", null);
   * }
   * ```
   */
  public offerPopup(address: string, origin: string | null, hadRecentInput?: boolean): void;

  /**
   * Says in the tab's notice that a request of the page got nothing, such as a new window Noldova Desktop didn't open as a page.
   * It does nothing once the controller closed or the tab is unavailable.
   *
   * @param request The request that got nothing.
   * @param target The address the request was for, such as the new window's; `null`, the default, for the page's own.
   * @example
   * ```ts
   * import { type PaneController, RefusedRequest } from "@noldova/browser.window";
   *
   * function refuse(controller: PaneController): void {
   *   controller.refuseRequest(RefusedRequest.NewWindow, "https://example.com/");
   * }
   * ```
   */
  public refuseRequest(request: RefusedRequest, target?: string | null): void;

  /**
   * Loads an address, after Noldova Desktop's origin check; a refusal also turns the status `Refused`.
   *
   * @param url The address to load.
   * @returns A promise of Noldova Desktop's answer, `Started` or `Refused` with the origin, which rejects when the view is closed or the pane has no view.
   * @throws {@link PaneUnavailableException} As the rejection, when the pane has no view, the host closed its view, or the controller closed.
   * @example
   * ```ts
   * import { WebViewNavigationKind } from "@noldova/desktop.protocol";
   * import type { PaneController } from "@noldova/browser.window";
   *
   * async function openAsync(controller: PaneController): Promise<boolean> {
   *   return (await controller.navigateAsync("https://example.com/")).kind === WebViewNavigationKind.Started;
   * }
   * ```
   */
  public navigateAsync(url: string): Promise<WebViewNavigation>;

  /**
   * Goes back one history entry, for the pane's back control; a refusal also turns the status `Refused`.
   *
   * @returns A promise of Noldova Desktop's answer, `Started`, `Refused` with the origin, or `NoHistory`, which rejects when the view is closed or the pane has no view.
   * @throws {@link PaneUnavailableException} As the rejection, when the pane has no view, the host closed its view, or the controller closed.
   * @example
   * ```ts
   * import type { PaneController } from "@noldova/browser.window";
   *
   * async function backAsync(controller: PaneController): Promise<void> {
   *   if (controller.status.canGoBack)
   *     await controller.goBackAsync();
   * }
   * ```
   */
  public goBackAsync(): Promise<WebViewNavigation>;

  /**
   * Goes forward one history entry, for the pane's forward control; a refusal also turns the status `Refused`.
   *
   * @returns A promise of Noldova Desktop's answer, `Started`, `Refused` with the origin, or `NoHistory`, which rejects when the view is closed or the pane has no view.
   * @throws {@link PaneUnavailableException} As the rejection, when the pane has no view, the host closed its view, or the controller closed.
   * @example
   * ```ts
   * import type { PaneController } from "@noldova/browser.window";
   *
   * async function forwardAsync(controller: PaneController): Promise<void> {
   *   if (controller.status.canGoForward)
   *     await controller.goForwardAsync();
   * }
   * ```
   */
  public goForwardAsync(): Promise<WebViewNavigation>;

  /**
   * Reloads the page, for the pane's reload control, which also restarts a crashed page; a refusal also turns the status `Refused`.
   *
   * @returns A promise of Noldova Desktop's answer, `Started` or `Refused` with the origin, which rejects when the view is closed or the pane has no view.
   * @throws {@link PaneUnavailableException} As the rejection, when the pane has no view, the host closed its view, or the controller closed.
   * @example
   * ```ts
   * import type { PaneController } from "@noldova/browser.window";
   *
   * async function reloadAsync(controller: PaneController): Promise<void> {
   *   await controller.reloadAsync();
   * }
   * ```
   */
  public reloadAsync(): Promise<WebViewNavigation>;

  /**
   * Stops the page's load, for the pane's stop control.
   *
   * @returns A promise of Noldova Desktop's answer, `Started`, which rejects when the view is closed or the pane has no view.
   * @throws {@link PaneUnavailableException} As the rejection, when the pane has no view, the host closed its view, or the controller closed.
   * @example
   * ```ts
   * import { type PaneController, PaneState } from "@noldova/browser.window";
   *
   * async function stopAsync(controller: PaneController): Promise<void> {
   *   if (controller.status.state === PaneState.Loading)
   *     await controller.stopAsync();
   * }
   * ```
   */
  public stopAsync(): Promise<WebViewNavigation>;

  /**
   * Steps the view's zoom in to Noldova Desktop's next step, as the person's Ctrl+= does; zoom listeners hear of the change.
   *
   * @returns A promise of the zoom the view took, as a factor, which stays at 5 at the greatest step, and which rejects when the view is closed or the pane has no view.
   * @throws {@link PaneUnavailableException} As the rejection, when the pane has no view, the host closed its view, or the controller closed.
   * @example
   * ```ts
   * import type { PaneController } from "@noldova/browser.window";
   *
   * async function zoomInAsync(controller: PaneController): Promise<number> {
   *   return controller.zoomInAsync();
   * }
   * ```
   */
  public zoomInAsync(): Promise<number>;

  /**
   * Steps the view's zoom out to Noldova Desktop's previous step, as the person's Ctrl+- does; zoom listeners hear of the change.
   *
   * @returns A promise of the zoom the view took, as a factor, which stays at 0.25 at the least step, and which rejects when the view is closed or the pane has no view.
   * @throws {@link PaneUnavailableException} As the rejection, when the pane has no view, the host closed its view, or the controller closed.
   * @example
   * ```ts
   * import type { PaneController } from "@noldova/browser.window";
   *
   * async function zoomOutAsync(controller: PaneController): Promise<number> {
   *   return controller.zoomOutAsync();
   * }
   * ```
   */
  public zoomOutAsync(): Promise<number>;

  /**
   * Sets the view's zoom back to 100%, as the person's Ctrl+0 does; zoom listeners hear of the change.
   *
   * @returns A promise of the zoom the view took, 1, which rejects when the view is closed or the pane has no view.
   * @throws {@link PaneUnavailableException} As the rejection, when the pane has no view, the host closed its view, or the controller closed.
   * @example
   * ```ts
   * import type { PaneController } from "@noldova/browser.window";
   *
   * async function resetZoomAsync(controller: PaneController): Promise<void> {
   *   if (controller.zoom !== 1)
   *     await controller.resetZoomAsync();
   * }
   * ```
   */
  public resetZoomAsync(): Promise<number>;

  /**
   * Searches the view's page for the text, ending any running search, and marks the first match, as the find bar does as the person types.
   *
   * @param text The text to find; an empty text only ends the running search.
   * @returns A promise of the number of matches and the 1-based active one, 0 when none, or of a search the engine timed out or that a navigation, a crash or a newer
   * search ended, with no matches.
   * @throws {@link PaneUnavailableException} As the rejection, when the pane has no view, the host closed its view, or the controller closed.
   * @example
   * ```ts
   * import type { PaneController } from "@noldova/browser.window";
   *
   * async function countAsync(controller: PaneController, text: string): Promise<number> {
   *   return (await controller.findAsync(text)).matches;
   * }
   * ```
   */
  public findAsync(text: string): Promise<IWebViewFound>;

  /**
   * Moves the running search to its next match, wrapping at the end, as Enter in the find bar does.
   *
   * @returns A promise of the number of matches and the 1-based active one; without a running search, of no matches.
   * @throws {@link PaneUnavailableException} As the rejection, when the pane has no view, the host closed its view, or the controller closed.
   * @example
   * ```ts
   * import type { PaneController } from "@noldova/browser.window";
   *
   * async function nextAsync(controller: PaneController): Promise<number> {
   *   return (await controller.findNextAsync()).active;
   * }
   * ```
   */
  public findNextAsync(): Promise<IWebViewFound>;

  /**
   * Moves the running search to its previous match, wrapping at the start, as Shift+Enter in the find bar does.
   *
   * @returns A promise of the number of matches and the 1-based active one; without a running search, of no matches.
   * @throws {@link PaneUnavailableException} As the rejection, when the pane has no view, the host closed its view, or the controller closed.
   * @example
   * ```ts
   * import type { PaneController } from "@noldova/browser.window";
   *
   * async function previousAsync(controller: PaneController): Promise<number> {
   *   return (await controller.findPreviousAsync()).active;
   * }
   * ```
   */
  public findPreviousAsync(): Promise<IWebViewFound>;

  /**
   * Ends the running search and clears its highlights, as closing the find bar does; nothing happens without a view, or once the controller closed.
   *
   * @example
   * ```ts
   * import type { PaneController } from "@noldova/browser.window";
   *
   * function closeFind(controller: PaneController): void {
   *   controller.endFind();
   * }
   * ```
   */
  public endFind(): void;

  /**
   * Drops the status's refused request, once the person dismissed its notice; listeners hear of the change.
   *
   * @example
   * ```ts
   * import type { PaneController } from "@noldova/browser.window";
   *
   * function dismiss(controller: PaneController): void {
   *   controller.dismissRequest();
   * }
   * ```
   */
  public dismissRequest(): void;

  /**
   * Sets the status's refused address, when the pane didn't go to an address the person typed; listeners hear of the change.
   * It does nothing once the controller is closed or the pane is unavailable.
   *
   * @param reason Why the address was refused.
   * @param origin The refused address's origin, when the runtime part refused its site; `null`, the default, for text that names no site,
   * as {@link PaneStatus.refuseAddress} takes it.
   * @example
   * ```ts
   * import { TypedAddressRefusal } from "@noldova/browser.protocol";
   * import type { PaneController } from "@noldova/browser.window";
   *
   * function refuse(controller: PaneController): void {
   *   controller.refuseAddress(TypedAddressRefusal.NotAnAddress);
   *   controller.refuseAddress(TypedAddressRefusal.Local, "http://192.168.1.20");
   * }
   * ```
   */
  public refuseAddress(reason: AddressRefusal, origin?: string | null): void;

  /**
   * Drops the status's refused address, once the person dismissed its notice or put the page's address back; listeners hear of the change.
   *
   * @example
   * ```ts
   * import type { PaneController } from "@noldova/browser.window";
   *
   * function dismiss(controller: PaneController): void {
   *   controller.dismissAddress();
   * }
   * ```
   */
  public dismissAddress(): void;

  /**
   * Stops following the page, drops every listener and closes the view, if any, which ends its pending calls; later calls do nothing.
   *
   * @example
   * ```ts
   * import type { PaneController } from "@noldova/browser.window";
   *
   * function close(controller: PaneController): void {
   *   controller.close();
   * }
   * ```
   */
  public close(): void;
}

/**
 * One pane's hearing of its page's events: the listeners of the events that aren't its status, the view's zoom, and the origin the check
 * last refused, whose failed load the pane doesn't show; it changes the status through the function its {@link PaneController} gives.
 */
export declare class PaneHearing {
  /**
   * Starts a hearing with no listeners and a zoom of 1.
   *
   * @param changeStatus Called with each event that changes the pane's status.
   * @example
   * ```ts
   * import { PaneHearing, PaneStatus, type ViewEvent } from "@noldova/browser.window";
   *
   * let status: PaneStatus = PaneStatus.empty;
   * const hearing: PaneHearing = new PaneHearing((event: ViewEvent) => {
   *   status = status.apply(event);
   * });
   * ```
   */
  public constructor(changeStatus: (event: ViewEvent) => void);

  /**
   * The view's zoom as a factor, 1 for 100%, which follows {@link PaneHearing.zoomTo}.
   */
  public get zoom(): number;

  /**
   * Tells the listener of each new window the page asks for, until it stops listening or the hearing is cleared.
   *
   * @param listener Called with each event.
   * @returns The function that stops it listening.
   * @example
   * ```ts
   * import type { PaneHearing, ViewNewWindowEvent } from "@noldova/browser.window";
   *
   * function follow(hearing: PaneHearing): () => void {
   *   return hearing.onNewWindow((event: ViewNewWindowEvent) => console.log(event.address));
   * }
   * ```
   */
  public onNewWindow(listener: (event: ViewNewWindowEvent) => void): () => void;

  /**
   * Tells the listener of each of the pane's keys the person presses in the page, until it stops listening or the hearing is cleared.
   *
   * @param listener Called with each event.
   * @returns The function that stops it listening.
   * @example
   * ```ts
   * import type { PaneHearing, ViewKeyEvent } from "@noldova/browser.window";
   *
   * function follow(hearing: PaneHearing): () => void {
   *   return hearing.onKey((event: ViewKeyEvent) => console.log(event.name));
   * }
   * ```
   */
  public onKey(listener: (event: ViewKeyEvent) => void): () => void;

  /**
   * Tells the listener of each change of the view's zoom, once each, until it stops listening or the hearing is cleared.
   *
   * @param listener Called with each factor.
   * @returns The function that stops it listening.
   * @example
   * ```ts
   * import type { PaneHearing } from "@noldova/browser.window";
   *
   * function follow(hearing: PaneHearing): () => void {
   *   return hearing.onZoom((factor: number) => console.log(factor));
   * }
   * ```
   */
  public onZoom(listener: (factor: number) => void): () => void;

  /**
   * Asks the listener first about each redirect the origin check refused, until it stops listening or the hearing is cleared; one that takes the redirect on answers true.
   *
   * @param listener Called with each event.
   * @returns The function that stops it listening.
   * @example
   * ```ts
   * import type { PaneHearing, ViewRefusalEvent } from "@noldova/browser.window";
   *
   * function follow(hearing: PaneHearing): () => void {
   *   return hearing.onRefusedRedirect((event: ViewRefusalEvent) => event.origin === "https://www.example.com");
   * }
   * ```
   */
  public onRefusedRedirect(listener: (event: ViewRefusalEvent) => boolean): () => void;

  /**
   * Changes the pane's status by the event.
   *
   * @param event The event, which the status applies.
   * @example
   * ```ts
   * import { PaneHearing, ViewCrashEvent } from "@noldova/browser.window";
   *
   * const hearing: PaneHearing = new PaneHearing(() => undefined);
   * hearing.change(new ViewCrashEvent());
   * ```
   */
  public change(event: ViewEvent): void;

  /**
   * Tells each new-window listener of the request.
   *
   * @param event The page's request.
   * @example
   * ```ts
   * import { PaneHearing, ViewNewWindowEvent } from "@noldova/browser.window";
   *
   * const hearing: PaneHearing = new PaneHearing(() => undefined);
   * hearing.openWindow(new ViewNewWindowEvent("https://www.example.com/", true, "https://docs.example.com"));
   * ```
   */
  public openWindow(event: ViewNewWindowEvent): void;

  /**
   * Tells each key listener of the key.
   *
   * @param event The key.
   * @example
   * ```ts
   * import { PaneHearing, ViewKeyEvent } from "@noldova/browser.window";
   *
   * const hearing: PaneHearing = new PaneHearing(() => undefined);
   * hearing.pressKey(new ViewKeyEvent("reload"));
   * ```
   */
  public pressKey(event: ViewKeyEvent): void;

  /**
   * Keeps the view's new zoom and tells each zoom listener of it, once: a zoom equal to the one kept tells none.
   *
   * @param factor The new zoom, 1 for 100%.
   * @returns The factor.
   * @example
   * ```ts
   * import { PaneHearing } from "@noldova/browser.window";
   *
   * const hearing: PaneHearing = new PaneHearing(() => undefined);
   * const zoom: number = hearing.zoomTo(1.25);
   * ```
   */
  public zoomTo(factor: number): number;

  /**
   * Keeps the refused origin, whose failed load the pane then doesn't show, and changes the status by the refusal, unless it is a redirect
   * that a redirect listener takes on.
   *
   * @param event The refusal.
   * @example
   * ```ts
   * import { PaneHearing, ViewRefusalEvent } from "@noldova/browser.window";
   *
   * const hearing: PaneHearing = new PaneHearing(() => undefined);
   * hearing.refuse(new ViewRefusalEvent("https://www.example.com/", "https://www.example.com", false));
   * ```
   */
  public refuse(event: ViewRefusalEvent): void;

  /**
   * Changes the status by the failed load, unless it is the load of the origin the check last refused, which the refusal shows: that one
   * ends the refusal's hold on failed loads.
   *
   * @param event The failed load.
   * @example
   * ```ts
   * import { PaneHearing, ViewLoadFailureEvent } from "@noldova/browser.window";
   *
   * const hearing: PaneHearing = new PaneHearing(() => undefined);
   * hearing.fail(new ViewLoadFailureEvent("https://www.example.com/", -105, "ERR_NAME_NOT_RESOLVED"));
   * ```
   */
  public fail(event: ViewLoadFailureEvent): void;

  /**
   * Changes the status by the page's state; once loading stops, a later failed load shows again.
   *
   * @param event The page's state.
   * @example
   * ```ts
   * import { PaneHearing, ViewStateEvent } from "@noldova/browser.window";
   *
   * const hearing: PaneHearing = new PaneHearing(() => undefined);
   * hearing.show(new ViewStateEvent("https://www.example.com/", "Example", false, true, false));
   * ```
   */
  public show(event: ViewStateEvent): void;

  /**
   * Stops every listener listening, as the controller does when it closes.
   *
   * @example
   * ```ts
   * import { PaneHearing } from "@noldova/browser.window";
   *
   * const hearing: PaneHearing = new PaneHearing(() => undefined);
   * hearing.clear();
   * ```
   */
  public clear(): void;
}

/**
 * Keeps the pane's view in its placeholder: it mounts the view there once, as the view opens, since its page loads only once it is mounted, where the view fills the placeholder as the page lays it out, and shows it while its page is placed.
 */
export declare class PlaceholderTracker {
  /**
   * Mounts the view in the placeholder, hidden, so its page loads; a closed view does nothing.
   *
   * @param element The positioned element that marks where the page shows, such as one with `position: relative`.
   * @param view The pane's page.
   * @example
   * ```ts
   * import type { IWebViewHandle } from "@noldova/desktop.window";
   * import { PlaceholderTracker } from "@noldova/browser.window";
   *
   * function track(element: HTMLElement, view: IWebViewHandle): PlaceholderTracker {
   *   return new PlaceholderTracker(element, view);
   * }
   * ```
   */
  public constructor(element: HTMLElement, view: IWebViewHandle);

  /**
   * Shows the view while its page is placed, and hides it otherwise; once disposed it does nothing, and so does a closed view.
   *
   * @param isShown Whether the page is placed.
   * @example
   * ```ts
   * import type { PlaceholderTracker } from "@noldova/browser.window";
   *
   * function placed(tracker: PlaceholderTracker): void {
   *   tracker.place(true);
   * }
   * ```
   */
  public place(isShown: boolean): void;

  /**
   * Hides the view; later calls do nothing, and so does a closed view.
   *
   * @example
   * ```ts
   * import type { PlaceholderTracker } from "@noldova/browser.window";
   *
   * function stop(tracker: PlaceholderTracker): void {
   *   tracker.dispose();
   * }
   * ```
   */
  public dispose(): void;
}

/**
 * The browser module's window part, which Noldova Desktop activates in each window: it keeps the window's web views while it is active, for the
 * panes that open their tabs' views, and continues when the runtime starts again, since the main process holds the views.
 *
 * @example
 * ```ts
 * import { windowPart } from "@noldova/browser.window";
 *
 * console.log(windowPart.moduleId);
 * ```
 */
export declare const windowPart: IWindowPart;

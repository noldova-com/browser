/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { IWindowPart } from "@noldova/desktop.window";

import { BrowserWindowPart } from "../app/services/browser-window-part.ts";

export { AddressRefusal } from "../app/enums/address-refusal.ts";
export { PaneState } from "../app/enums/pane-state.ts";
export { RefusedRequest } from "../app/enums/refused-request.ts";
export { ViewEventKind } from "../app/enums/view-event-kind.ts";
export { BrowserWindowException } from "../app/exceptions/browser-window.exception.ts";
export { PaneUnavailableException } from "../app/exceptions/pane-unavailable.exception.ts";
export { PaneStates } from "../app/models/pane-states.ts";
export { PaneStatus } from "../app/models/pane-status.ts";
export { PopupOffer } from "../app/models/popup-offer.ts";
export { ViewCloseEvent } from "../app/models/view-close-event.ts";
export { ViewCrashEvent } from "../app/models/view-crash-event.ts";
export { ViewEvent } from "../app/models/view-event.ts";
export { ViewFaviconEvent } from "../app/models/view-favicon-event.ts";
export { ViewKeyEvent } from "../app/models/view-key-event.ts";
export { ViewLoadFailureEvent } from "../app/models/view-load-failure-event.ts";
export { ViewNewWindowEvent } from "../app/models/view-new-window-event.ts";
export { ViewProfileClearedEvent } from "../app/models/view-profile-cleared-event.ts";
export { ViewRefusalEvent } from "../app/models/view-refusal-event.ts";
export { ViewRequestRefusalEvent } from "../app/models/view-request-refusal-event.ts";
export { ViewStateEvent } from "../app/models/view-state-event.ts";
export { ViewZoomEvent } from "../app/models/view-zoom-event.ts";
export { PaneController } from "../app/services/pane-controller.ts";
export { PaneHearing } from "../app/services/pane-hearing.ts";
export { PlaceholderTracker } from "../app/services/placeholder-tracker.ts";

export const windowPart: IWindowPart = new BrowserWindowPart();

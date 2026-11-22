/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import * as api from "../../src/api/index.ts";
import { AddressRefusal } from "../../src/app/enums/address-refusal.ts";
import { PaneState } from "../../src/app/enums/pane-state.ts";
import { RefusedRequest } from "../../src/app/enums/refused-request.ts";
import { ViewEventKind } from "../../src/app/enums/view-event-kind.ts";
import { BrowserWindowException } from "../../src/app/exceptions/browser-window.exception.ts";
import { PaneUnavailableException } from "../../src/app/exceptions/pane-unavailable.exception.ts";
import { PaneStates } from "../../src/app/models/pane-states.ts";
import { PaneStatus } from "../../src/app/models/pane-status.ts";
import { PopupOffer } from "../../src/app/models/popup-offer.ts";
import { ViewCloseEvent } from "../../src/app/models/view-close-event.ts";
import { ViewCrashEvent } from "../../src/app/models/view-crash-event.ts";
import { ViewEvent } from "../../src/app/models/view-event.ts";
import { ViewFaviconEvent } from "../../src/app/models/view-favicon-event.ts";
import { ViewKeyEvent } from "../../src/app/models/view-key-event.ts";
import { ViewLoadFailureEvent } from "../../src/app/models/view-load-failure-event.ts";
import { ViewNewWindowEvent } from "../../src/app/models/view-new-window-event.ts";
import { ViewProfileClearedEvent } from "../../src/app/models/view-profile-cleared-event.ts";
import { ViewRefusalEvent } from "../../src/app/models/view-refusal-event.ts";
import { ViewRequestRefusalEvent } from "../../src/app/models/view-request-refusal-event.ts";
import { ViewStateEvent } from "../../src/app/models/view-state-event.ts";
import { ViewZoomEvent } from "../../src/app/models/view-zoom-event.ts";
import { BrowserWindowPart } from "../../src/app/services/browser-window-part.ts";
import { PaneController } from "../../src/app/services/pane-controller.ts";
import { PaneHearing } from "../../src/app/services/pane-hearing.ts";
import { PlaceholderTracker } from "../../src/app/services/placeholder-tracker.ts";

describe("@noldova/browser.window", () => {
  it("exports exactly its public values", () => {
    expect(Object.fromEntries(Object.entries(api))).toEqual({
      AddressRefusal, BrowserWindowException, PaneController, PaneHearing, PaneState, PaneStates, PaneStatus, PaneUnavailableException, PlaceholderTracker, PopupOffer, RefusedRequest,
      ViewCloseEvent, ViewCrashEvent, ViewEvent, ViewEventKind, ViewFaviconEvent, ViewKeyEvent, ViewLoadFailureEvent, ViewNewWindowEvent, ViewProfileClearedEvent, ViewRefusalEvent,
      ViewRequestRefusalEvent, ViewStateEvent, ViewZoomEvent, windowPart: expect.any(BrowserWindowPart)
    });
  });

  it("exports the browser module's window part", () => {
    expect(api.windowPart.moduleId).toBe("browser");
  });
});

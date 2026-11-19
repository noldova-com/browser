/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { WebViewEventKind, type WebViewEvent } from "@noldova/desktop.protocol";

import { Resources } from "../../resources.ts";
import { RefusedRequest } from "../enums/refused-request.ts";
import { ViewCloseEvent } from "../models/view-close-event.ts";
import { ViewCrashEvent } from "../models/view-crash-event.ts";
import type { ViewEvent } from "../models/view-event.ts";
import { ViewKeyEvent } from "../models/view-key-event.ts";
import { ViewLoadFailureEvent } from "../models/view-load-failure-event.ts";
import { ViewNewWindowEvent } from "../models/view-new-window-event.ts";
import { ViewProfileClearedEvent } from "../models/view-profile-cleared-event.ts";
import { ViewRefusalEvent } from "../models/view-refusal-event.ts";
import { ViewRequestRefusalEvent } from "../models/view-request-refusal-event.ts";
import { ViewStateEvent } from "../models/view-state-event.ts";
import { ViewZoomEvent } from "../models/view-zoom-event.ts";

export class WebViewEventReader {
  public static read(event: WebViewEvent): ViewEvent | null {
    switch (event.kind) {
      case WebViewEventKind.Closed:
        return new ViewCloseEvent();
      case WebViewEventKind.Crashed:
        return new ViewCrashEvent();
      case WebViewEventKind.State: {
        const { address, title, isLoading, canGoBack, canGoForward } = event.details;
        return typeof address === "string" && typeof title === "string" && typeof isLoading === "boolean" && typeof canGoBack === "boolean"
          && typeof canGoForward === "boolean"
          ? new ViewStateEvent(address, title, isLoading, canGoBack, canGoForward)
          : null;
      }
      case WebViewEventKind.LoadFailed: {
        const { address, code, description } = event.details;
        return typeof address === "string" && typeof code === "number" && typeof description === "string" ? new ViewLoadFailureEvent(address, code, description) : null;
      }
      case WebViewEventKind.NavigationRefused: {
        const { address, origin, isRedirect } = event.details;
        return typeof address === "string" && typeof origin === "string" && typeof isRedirect === "boolean"
          ? new ViewRefusalEvent(address, origin, isRedirect)
          : null;
      }
      case WebViewEventKind.ProfileCleared: {
        const { profileKey } = event.details;
        return typeof profileKey === "string" ? new ViewProfileClearedEvent(profileKey) : null;
      }
      case WebViewEventKind.RequestRefused: {
        const { request, origin } = event.details;
        const refused: RefusedRequest | null = WebViewEventReader.readRefusedRequest(request);
        return refused !== null && typeof origin === "string" ? new ViewRequestRefusalEvent(refused, origin) : null;
      }
      case WebViewEventKind.NewWindowRequested: {
        const { address, hadRecentInput, origin, disposition } = event.details;
        return typeof address === "string" && typeof hadRecentInput === "boolean" && (typeof origin === "string" || origin === null)
          && (typeof disposition === "string" || disposition === undefined)
          ? new ViewNewWindowEvent(address, hadRecentInput, origin, disposition === Resources.backgroundTabDisposition)
          : null;
      }
      case WebViewEventKind.Key: {
        const { name } = event.details;
        return typeof name === "string" ? new ViewKeyEvent(name) : null;
      }
      case WebViewEventKind.Zoom: {
        const { factor } = event.details;
        return typeof factor === "number" ? new ViewZoomEvent(factor) : null;
      }
      default:
        return null;
    }
  }

  private static readRefusedRequest(value: unknown): RefusedRequest | null {
    return Object.values(RefusedRequest).find(t => Resources.refusedRequestNames[t] === value) ?? null;
  }
}

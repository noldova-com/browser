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
import { ViewFaviconEvent } from "../models/view-favicon-event.ts";
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
        return Object.isString(address) && Object.isString(title) && Object.isBoolean(isLoading) && Object.isBoolean(canGoBack)
          && Object.isBoolean(canGoForward)
          ? new ViewStateEvent(address, title, isLoading, canGoBack, canGoForward)
          : null;
      }
      case WebViewEventKind.LoadFailed: {
        const { address, code, description } = event.details;
        return Object.isString(address) && Object.isNumber(code) && Object.isString(description) ? new ViewLoadFailureEvent(address, code, description) : null;
      }
      case WebViewEventKind.NavigationRefused: {
        const { address, origin, isRedirect } = event.details;
        return Object.isString(address) && Object.isString(origin) && Object.isBoolean(isRedirect)
          ? new ViewRefusalEvent(address, origin, isRedirect)
          : null;
      }
      case WebViewEventKind.ProfileCleared: {
        const { profileKey } = event.details;
        return Object.isString(profileKey) ? new ViewProfileClearedEvent(profileKey) : null;
      }
      case WebViewEventKind.RequestRefused: {
        const { request, origin } = event.details;
        const refused: RefusedRequest | null = WebViewEventReader.readRefusedRequest(request);
        return !Object.isNull(refused) && Object.isString(origin) ? new ViewRequestRefusalEvent(refused, origin) : null;
      }
      case WebViewEventKind.NewWindowRequested: {
        const { address, hadRecentInput, origin, disposition, fromPress } = event.details;
        return Object.isString(address) && Object.isBoolean(hadRecentInput) && (Object.isString(origin) || Object.isNull(origin))
          && (Object.isString(disposition) || Object.isUndefined(disposition)) && (Object.isBoolean(fromPress) || Object.isUndefined(fromPress))
          ? new ViewNewWindowEvent(address, hadRecentInput, origin, disposition === Resources.backgroundTabDisposition, fromPress === true)
          : null;
      }
      case WebViewEventKind.Key: {
        const { name } = event.details;
        return Object.isString(name) ? new ViewKeyEvent(name) : null;
      }
      case WebViewEventKind.Zoom: {
        const { factor } = event.details;
        return Object.isNumber(factor) && Number.isFinite(factor) && factor > 0 ? new ViewZoomEvent(factor) : null;
      }
      case WebViewEventKind.Favicon: {
        const { image } = event.details;
        return Object.isNull(image) || (Object.isString(image) && Resources.pageImagePattern.test(image)) ? new ViewFaviconEvent(image) : null;
      }
      default:
        return null;
    }
  }

  private static readRefusedRequest(value: unknown): RefusedRequest | null {
    return Object.isString(value) ? Object.values(RefusedRequest).find(t => Resources.refusedRequestNames[t] === value) ?? null : null;
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type WebViewEvent, WebViewEventKind } from "@noldova/desktop.protocol";
import type { WebViewProtocolEvent } from "@noldova/desktop.runtime";

import { Resources } from "../resources.ts";
import type { JsonValue } from "../types/json-value.ts";
import { JsonShapes } from "./json-shapes.ts";

// The events that start a frame's navigation to another document or end it, which the watches over a view's navigations share.
export class NavigationEvents {
  private static readonly ENDING_KINDS: readonly WebViewEventKind[] = [WebViewEventKind.NavigationRefused, WebViewEventKind.Crashed, WebViewEventKind.Closed];

  // Whether the view's event ends every navigation in it: the origin check refused one, or the view crashed or closed.
  public static isViewEnd(event: WebViewEvent, viewId: string): boolean {
    return event.view === viewId && NavigationEvents.ENDING_KINDS.includes(event.kind);
  }

  // Whether the event starts a navigation of the frame to another document, not a move within the one it shows.
  public static isDocumentStart(event: WebViewProtocolEvent, frameId: string): boolean {
    return event.method === Resources.frameStartedNavigatingEvent && event.params[Resources.frameIdField] === frameId
      && !Resources.sameDocumentNavigationTypes.includes(String(event.params[Resources.navigationTypeField]));
  }

  // Whether the frame committed a document: once it did, the calls the page answers answer again.
  public static isCommit(event: WebViewProtocolEvent, frameId: string): boolean {
    const frame: JsonValue | undefined = event.params[Resources.frameField];
    return event.method === Resources.frameNavigatedEvent && JsonShapes.isObject(frame) && frame[Resources.idField] === frameId;
  }

  // Whether the frame stopped loading, which ends its navigation only once it started, as the old document's stop may come before.
  public static isStop(event: WebViewProtocolEvent, frameId: string): boolean {
    return event.method === Resources.frameStoppedLoadingEvent && event.params[Resources.frameIdField] === frameId;
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IWebViewRelay, WebViewProtocolEvent } from "@noldova/desktop.runtime";

import { Resources } from "../resources.ts";
import type { WithinDocumentMove } from "../models/within-document-move.ts";
import type { JsonValue } from "../types/json-value.ts";
import { JsonShapes } from "./json-shapes.ts";
import { ToolFailures } from "./tool-failures.ts";

export class LoadWaiter implements Disposable {
  private readonly loaded: PromiseWithResolvers<void> = Promise.withResolvers<void>();
  private readonly stop: () => void;

  // `within` is a move that may stay in its document, such as back to an entry a page pushed or to a fragment: such a move fires no load, so its
  // frame's navigation to its URL ends the wait too, unless the frame took a new document first, whose load the wait is for.
  // `frameId` is the main frame a move navigates: a load counts only once that frame committed the document of the newest navigation that
  // started in it after the wait began, so neither the load of the document the move leaves nor that of one an earlier move left loading,
  // which started before, ends the wait. With none, as for a wait for the page's next load, any load counts.
  public constructor(relay: IWebViewRelay, viewId: string, within: WithinDocumentMove | null, frameId: string | null) {
    let isNewDocument: boolean = false;
    let started: JsonValue | undefined;
    let isCommitted: boolean = Object.isNull(frameId);
    this.stop = relay.onProtocolEvent(viewId, (event: WebViewProtocolEvent) => {
      if (event.method === Resources.loadEvent && isCommitted)
        this.loaded.resolve();
      else if (event.method === Resources.frameStartedNavigatingEvent && event.params[Resources.frameIdField] === frameId
        && !Resources.sameDocumentNavigationTypes.includes(String(event.params[Resources.navigationTypeField]))) {
        started = event.params[Resources.loaderIdField];
        isCommitted = false;
      }
      else if (event.method === Resources.frameNavigatedEvent) {
        const frame: JsonValue | undefined = event.params[Resources.frameField];
        isNewDocument ||= !Object.isNull(within) && LoadWaiter.idOf(frame) === within.frameId;
        isCommitted ||= !Object.isUndefined(started) && LoadWaiter.isCommit(frame, frameId, started);
      }
      else if (event.method === Resources.navigatedWithinDocumentEvent && !isNewDocument && !Object.isNull(within) && event.params[Resources.frameIdField] === within.frameId
        && event.params[Resources.urlField] === within.url)
        this.loaded.resolve();
    });
  }

  // Ends the wait as a load would, for a navigation that ends without one.
  public end(): void {
    this.loaded.resolve();
  }

  public waitAsync(until: number, signal: AbortSignal): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      const finish = (): void => {
        clearTimeout(timer);
        signal.removeEventListener("abort", abort);
      };
      const abort = (): void => {
        finish();
        reject(ToolFailures.fromAbort(signal.reason));
      };
      const timer: ReturnType<typeof setTimeout> = setTimeout(() => {
        finish();
        resolve(false);
      }, Math.max(0, until - Date.now()));
      if (signal.aborted) {
        abort();
        return;
      }
      signal.addEventListener("abort", abort, { once: true });
      void this.loaded.promise.then(() => {
        finish();
        resolve(true);
      });
    });
  }

  private static idOf(frame: JsonValue | undefined): JsonValue | undefined {
    return JsonShapes.isObject(frame) ? frame[Resources.idField] : undefined;
  }

  // Whether the navigated frame is the move's, committing the document of its newest navigation.
  private static isCommit(frame: JsonValue | undefined, frameId: string | null, loaderId: JsonValue | undefined): boolean {
    return JsonShapes.isObject(frame) && frame[Resources.idField] === frameId && frame[Resources.loaderIdField] === loaderId;
  }

  public [Symbol.dispose](): void {
    this.stop();
  }
}

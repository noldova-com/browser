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
  public constructor(relay: IWebViewRelay, viewId: string, within: WithinDocumentMove | null) {
    let isNewDocument: boolean = false;
    this.stop = relay.onProtocolEvent(viewId, (event: WebViewProtocolEvent) => {
      if (event.method === Resources.loadEvent)
        this.loaded.resolve();
      else if (event.method === Resources.frameNavigatedEvent && within !== null && LoadWaiter.idOf(event.params[Resources.frameField]) === within.frameId)
        isNewDocument = true;
      else if (event.method === Resources.navigatedWithinDocumentEvent && !isNewDocument && within !== null && event.params[Resources.frameIdField] === within.frameId
        && event.params[Resources.urlField] === within.url)
        this.loaded.resolve();
    });
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

  public [Symbol.dispose](): void {
    this.stop();
  }
}

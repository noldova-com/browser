/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IWebViewRelay, WebViewProtocolEvent } from "@noldova/desktop.runtime";

import { Resources } from "../resources.ts";
import { ToolFailures } from "./tool-failures.ts";

export class LoadWaiter implements Disposable {
  private readonly loaded: PromiseWithResolvers<void> = Promise.withResolvers<void>();
  private readonly stop: () => void;

  public constructor(relay: IWebViewRelay, viewId: string) {
    this.stop = relay.onProtocolEvent(viewId, (event: WebViewProtocolEvent) => {
      if (event.method === Resources.loadEvent)
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

  public [Symbol.dispose](): void {
    this.stop();
  }
}

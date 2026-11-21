/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type WebViewEvent, WebViewEventKind } from "@noldova/desktop.protocol";
import type { IRuntimeWebViews, WebViewProtocolEvent } from "@noldova/desktop.runtime";

import { Resources } from "../resources.ts";
import { LoadWaiter } from "./load-waiter.ts";

// Watches, from before an input, whether the input made the page ask to navigate its main frame in place, as a link's click or a form's
// Enter does, and waits for that navigation's load. A navigation that ends without a load ends the wait too: a move within the document,
// one the frame stops loading without once it started, as for an answer with no content or a download, one the origin check refuses, and
// the view's crash or close. A stop before the navigation started is the old document's, so it doesn't end the wait.
export class NavigationWatch implements Disposable {
  private static readonly ENDING_KINDS: readonly WebViewEventKind[] = [WebViewEventKind.NavigationRefused, WebViewEventKind.Crashed, WebViewEventKind.Closed];
  private readonly loads: LoadWaiter;
  private readonly requests: PromiseWithResolvers<void> = Promise.withResolvers<void>();
  private readonly stopProtocol: () => void;
  private readonly stopView: () => void;
  private isRequested: boolean = false;
  private isStarted: boolean = false;

  public constructor(webViews: IRuntimeWebViews, viewId: string, frameId: string) {
    this.loads = new LoadWaiter(webViews.relay, viewId, null, frameId);
    this.stopProtocol = webViews.relay.onProtocolEvent(viewId, (event: WebViewProtocolEvent) => {
      if (event.params[Resources.frameIdField] !== frameId)
        return;
      if (event.method === Resources.frameRequestedNavigationEvent && event.params[Resources.dispositionField] === Resources.currentTabDisposition) {
        this.isRequested = true;
        this.requests.resolve();
      }
      else if (event.method === Resources.frameStartedNavigatingEvent && this.isRequested)
        this.isStarted = true;
      else if (event.method === Resources.navigatedWithinDocumentEvent && this.isRequested
        || event.method === Resources.frameStoppedLoadingEvent && this.isStarted)
        this.loads.end();
    });
    this.stopView = webViews.onViewEvent((event: WebViewEvent) => {
      if (event.view === viewId && NavigationWatch.ENDING_KINDS.includes(event.kind))
        this.loads.end();
    });
  }

  // Settles once the page asked for the navigation, which it does before the engine starts it.
  public get requested(): Promise<void> {
    return this.requests.promise;
  }

  // Whether the page is done with what the input started: at once when the page asked for no navigation, and otherwise once the navigation
  // loaded or ended, or `false` when `until` comes first.
  public waitAsync(until: number, signal: AbortSignal): Promise<boolean> {
    return this.isRequested ? this.loads.waitAsync(until, signal) : Promise.resolve(true);
  }

  public [Symbol.dispose](): void {
    this.stopProtocol();
    this.stopView();
    this.loads[Symbol.dispose]();
  }
}

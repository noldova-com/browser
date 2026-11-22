/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type WebViewEvent, WebViewEventKind } from "@noldova/desktop.protocol";
import type { IRuntimeWebViews, WebViewProtocolEvent } from "@noldova/desktop.runtime";

import { PendingNavigation } from "../models/pending-navigation.ts";
import { NavigationEvents } from "./navigation-events.ts";
import { ToolFailures } from "./tool-failures.ts";

// Tracks, for each view whose frame tree a tool read, whether its main frame waits for the next document of a navigation. While it does,
// every call the page answers waits for that document, so a read waits for the navigation to end first. The page sends the events because
// Noldova Desktop enables its Page domain when it attaches the view, whichever tool comes first; a read itself enables nothing.
export class PendingNavigations {
  private readonly webViews: IRuntimeWebViews;
  private readonly views: Map<string, PendingNavigation> = new Map<string, PendingNavigation>();

  public constructor(webViews: IRuntimeWebViews) {
    this.webViews = webViews;
  }

  // Watches the view's main frame, which the latest read of its frame tree named.
  public watch(viewId: string, frameId: string): void {
    const known: PendingNavigation | undefined = this.views.get(viewId);
    if (!Object.isUndefined(known)) {
      known.rename(frameId);
      return;
    }
    const navigation: PendingNavigation = new PendingNavigation(frameId);
    this.views.set(viewId, navigation);
    const stopProtocol: () => void = this.webViews.relay.onProtocolEvent(viewId, (event: WebViewProtocolEvent) => {
      if (NavigationEvents.isDocumentStart(event, navigation.frameId))
        navigation.start();
      else if (NavigationEvents.isCommit(event, navigation.frameId) || NavigationEvents.isStop(event, navigation.frameId))
        navigation.end();
    });
    const stopView: () => void = this.webViews.onViewEvent((event: WebViewEvent) => {
      if (!NavigationEvents.isViewEnd(event, viewId))
        return;
      navigation.end();
      if (event.kind !== WebViewEventKind.Closed)
        return;
      stopProtocol();
      stopView();
      this.views.delete(viewId);
    });
  }

  public isPending(viewId: string): boolean {
    return this.views.get(viewId)?.isPending === true;
  }

  // Settles at the view's next navigation start, never for a view it doesn't watch.
  public startedAsync(viewId: string): Promise<void> {
    return this.views.get(viewId)?.started ?? new Promise<void>(() => undefined);
  }

  // Whether no navigation of the view is pending, waiting for a pending one to end until `until`.
  public settleAsync(viewId: string, until: number, signal: AbortSignal): Promise<boolean> {
    const navigation: PendingNavigation | undefined = this.views.get(viewId);
    if (Object.isUndefined(navigation) || !navigation.isPending)
      return Promise.resolve(true);
    if (until <= Date.now())
      return Promise.resolve(false);
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
      }, until - Date.now());
      if (signal.aborted) {
        abort();
        return;
      }
      signal.addEventListener("abort", abort, { once: true });
      void navigation.ended.then(() => {
        finish();
        resolve(true);
      });
    });
  }
}

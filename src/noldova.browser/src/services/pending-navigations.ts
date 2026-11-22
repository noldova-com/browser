/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type WebViewEvent, WebViewEventKind } from "@noldova/desktop.protocol";
import { type IRuntimeWebViews, ModuleDeactivatedException, WebViewFailureException, type WebViewProtocolEvent } from "@noldova/desktop.runtime";

import { MalformedReplyException } from "../exceptions/malformed-reply.exception.ts";
import { PendingNavigation } from "../models/pending-navigation.ts";
import { Resources } from "../resources.ts";
import type { JsonValue } from "../types/json-value.ts";
import { FrameTreeReader } from "./frame-tree.reader.ts";
import { JsonShapes } from "./json-shapes.ts";
import { NavigationEvents } from "./navigation-events.ts";
import { ToolFailures } from "./tool-failures.ts";

// Tracks, for each view it follows, whether its main frame waits for the next document of a navigation. While it does, every call the
// page answers waits for that document, so a read waits for the navigation to end first. The page sends the events because Noldova
// Desktop enables its Page domain when it attaches the view, as it opens; a read itself enables nothing. A view is followed from its
// opening, or from the module's start for one already open, and its main frame is the one its frame tree, a commit with no parent or a
// tool's read of the frame tree names; until one does, none of its navigations is followed.
export class PendingNavigations implements Disposable {
  // No frame has an empty id, so a view whose main frame no commit or read named yet matches no navigation event.
  private static readonly UNNAMED: string = "";

  private readonly webViews: IRuntimeWebViews;
  private readonly views: Map<string, PendingNavigation> = new Map<string, PendingNavigation>();
  private readonly stops: Map<string, () => void> = new Map<string, () => void>();

  public constructor(webViews: IRuntimeWebViews) {
    this.webViews = webViews;
  }

  // Watches the view's main frame, which the latest read of its frame tree named.
  public watch(viewId: string, frameId: string): void {
    this.navigationOf(viewId).rename(frameId);
  }

  // Follows the view's navigations once a commit or a read names its main frame. A view the module meets after its first commit has no
  // commit left to name it, so its frame tree does; a view that doesn't answer, or whose frame tree is malformed, leaves that to its next
  // commit or read. Settles once the frame tree is read or refused, and fails with any other failure, which is a bug.
  public async followAsync(viewId: string): Promise<void> {
    if (this.views.has(viewId))
      return;
    await this.nameAsync(viewId, this.navigationOf(viewId)).catch((error: unknown) => PendingNavigations.unnamed(error));
  }

  // Stops following every view, as the module stops.
  public [Symbol.dispose](): void {
    for (const stop of [...this.stops.values()])
      stop();
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

  private navigationOf(viewId: string): PendingNavigation {
    const known: PendingNavigation | undefined = this.views.get(viewId);
    if (!Object.isUndefined(known))
      return known;
    const navigation: PendingNavigation = new PendingNavigation(PendingNavigations.UNNAMED);
    this.views.set(viewId, navigation);
    const stopProtocol: () => void = this.webViews.relay.onProtocolEvent(viewId, (event: WebViewProtocolEvent) => {
      const committed: string | null = NavigationEvents.mainCommitOf(event);
      if (!Object.isNull(committed))
        navigation.rename(committed);
      if (NavigationEvents.isDocumentStart(event, navigation.frameId))
        navigation.start();
      else if (NavigationEvents.isCommit(event, navigation.frameId) || NavigationEvents.isStop(event, navigation.frameId))
        navigation.end();
    });
    const stopView: () => void = this.webViews.onViewEvent((event: WebViewEvent) => {
      if (!NavigationEvents.isViewEnd(event, viewId))
        return;
      navigation.end();
      if (event.kind === WebViewEventKind.Closed)
        stop();
    });
    const stop = (): void => {
      stopProtocol();
      stopView();
      this.views.delete(viewId);
      this.stops.delete(viewId);
    };
    this.stops.set(viewId, stop);
    return navigation;
  }

  private static unnamed(error: unknown): void {
    if (!(error instanceof WebViewFailureException || error instanceof ModuleDeactivatedException || error instanceof MalformedReplyException))
      throw error;
  }

  private async nameAsync(viewId: string, navigation: PendingNavigation): Promise<void> {
    const reply: JsonValue = await this.webViews.relay.sendAsync(viewId, Resources.getFrameTreeMethod, {}, Resources.maximumTimeoutMilliseconds);
    if (JsonShapes.isObject(reply) && navigation.frameId === PendingNavigations.UNNAMED)
      navigation.rename(FrameTreeReader.read(reply).frameId);
  }
}

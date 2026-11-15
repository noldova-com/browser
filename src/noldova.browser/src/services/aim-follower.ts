/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { PageBox } from "@noldova/browser.protocol";

import { BrowserRuntimeException } from "../exceptions/browser-runtime.exception.ts";
import { CallFailureException } from "../exceptions/call-failure.exception.ts";
import { MalformedReplyException } from "../exceptions/malformed-reply.exception.ts";
import { BrowserLimits } from "../models/browser-limits.ts";
import type { CallOptions } from "../models/call-options.ts";
import { ChangeQueue } from "../models/change-queue.ts";
import type { ElementReference } from "../models/element-reference.ts";
import type { LayoutMetrics } from "../models/layout-metrics.ts";
import type { PageActivity } from "../models/page-activity.ts";
import { Resources } from "../resources.ts";
import type { JsonObject, JsonValue } from "../types/json-value.ts";
import { ContentQuads } from "./content-quads.ts";
import { FrameTreeReader } from "./frame-tree.reader.ts";
import { LayoutMetricsReader } from "./layout-metrics.reader.ts";
import { NodeFactsReader } from "./node-facts.reader.ts";
import type { PageChanges } from "./page-changes.ts";
import type { ViewCalls } from "./view-calls.ts";

export class AimFollower {
  public static async whileAsync<T>(calls: ViewCalls, changes: PageChanges, element: ElementReference, activity: PageActivity, options: CallOptions,
    askAsync: () => Promise<T>): Promise<T> {
    const stop: AbortController = new AbortController();
    const signal: AbortSignal = AbortSignal.any([stop.signal, options.signal]);
    const following: Promise<[PromiseSettledResult<void>]> = Promise.allSettled([AimFollower.followAsync(calls, changes, element, activity, options, signal)]);
    try {
      return await askAsync();
    }
    finally {
      stop.abort();
      AimFollower.rethrow(await following);
    }
  }

  private static rethrow([followed]: [PromiseSettledResult<void>]): void {
    if (followed.status === "rejected")
      throw followed.reason;
  }

  private static async followAsync(calls: ViewCalls, changes: PageChanges, element: ElementReference, activity: PageActivity, options: CallOptions,
    signal: AbortSignal): Promise<void> {
    const reading = (): CallOptions => options.withSignal(signal, Date.now() + Resources.readMilliseconds);
    const heard: ChangeQueue = new ChangeQueue(signal);
    const stopHearing: (() => void) | null = await changes.hearAsync(element.viewId, reading(), () => heard.add()).catch((error: unknown) => AimFollower.unheard(error));
    if (stopHearing === null)
      return;
    try {
      while (await heard.nextAsync()) {
        const documentId: string | null = await AimFollower.readDocumentAsync(calls, element.viewId, reading).catch((error: unknown) => AimFollower.unread(error));
        const isLeft: boolean = documentId !== null && documentId !== element.documentId;
        const box: PageBox | null = documentId === element.documentId
          ? await AimFollower.readBoxAsync(calls, element, reading).catch((error: unknown) => AimFollower.unread(error))
          : null;
        if (signal.aborted)
          return;
        activity.follow(box);
        if (isLeft)
          return;
      }
    }
    finally {
      stopHearing();
    }
  }

  private static unheard(error: unknown): null {
    if (error instanceof BrowserRuntimeException)
      return null;
    throw error;
  }

  private static unread(error: unknown): null {
    if (error instanceof CallFailureException)
      return null;
    throw error;
  }

  private static async readDocumentAsync(calls: ViewCalls, viewId: string, reading: () => CallOptions): Promise<string> {
    return FrameTreeReader.read(await calls.sendAsync(viewId, Resources.getFrameTreeMethod, {}, reading())).documentId;
  }

  private static async readBoxAsync(calls: ViewCalls, element: ElementReference, reading: () => CallOptions): Promise<PageBox | null> {
    const { viewId, backendNodeId }: ElementReference = element;
    const quad: readonly number[] | null = ContentQuads.readFirst(await calls.sendAsync(viewId, Resources.getContentQuadsMethod, { backendNodeId }, reading()));
    if (quad === null)
      return null;
    const box: PageBox = ContentQuads.toBox(quad);
    const viewport: LayoutMetrics = LayoutMetricsReader.read(await calls.sendAsync(viewId, Resources.getLayoutMetricsMethod, {}, reading()));
    const left: number = Math.max(box.x, 0);
    const top: number = Math.max(box.y, 0);
    const right: number = Math.min(box.x + box.width, viewport.width);
    const bottom: number = Math.min(box.y + box.height, viewport.height);
    if (right <= left || bottom <= top)
      return null;
    const x: number = Math.floor((left + right) / 2 + viewport.pageX);
    const y: number = Math.floor((top + bottom) / 2 + viewport.pageY);
    const hit: JsonObject = await calls.sendAsync(viewId, Resources.getNodeForLocationMethod, { x, y, includeUserAgentShadowDOM: false }, reading());
    const topmost: JsonValue | undefined = hit[Resources.backendNodeIdField];
    if (topmost === backendNodeId)
      return box;
    if (typeof topmost !== "number")
      throw new MalformedReplyException();
    const subtree: JsonObject = await calls.sendAsync(viewId, Resources.describeNodeMethod, { backendNodeId, depth: Resources.wholeSubtreeDepth, pierce: true },
      reading().withMaximumReplyBytes(BrowserLimits.maximumTreeReplyBytes));
    return NodeFactsReader.holds(subtree, topmost) ? box : null;
  }
}

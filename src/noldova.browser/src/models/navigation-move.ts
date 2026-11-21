/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { WebViewNavigation } from "@noldova/desktop.protocol";
import type { IRuntimeWebViews } from "@noldova/desktop.runtime";

import { MalformedReplyException } from "../exceptions/malformed-reply.exception.ts";
import { Resources } from "../resources.ts";
import { JsonShapes } from "../services/json-shapes.ts";
import type { ViewCalls } from "../services/view-calls.ts";
import type { JsonObject, JsonValue } from "../types/json-value.ts";
import type { CallOptions } from "./call-options.ts";
import type { FrameFacts } from "./frame-facts.ts";
import type { HistoryTarget } from "./history-target.ts";
import type { WithinDocumentMove } from "./within-document-move.ts";

export abstract class NavigationMove {
  public abstract readTargetAsync(calls: ViewCalls, viewId: string, frame: FrameFacts, options: CallOptions): Promise<HistoryTarget>;

  public abstract readWithinDocument(frame: FrameFacts, target: HistoryTarget): WithinDocumentMove | null;

  public abstract goAsync(webViews: IRuntimeWebViews, viewId: string): Promise<WebViewNavigation>;

  public abstract isLandedAsync(calls: ViewCalls, viewId: string, left: FrameFacts, target: HistoryTarget, landed: FrameFacts, options: CallOptions): Promise<boolean>;

  protected static async readHistoryAsync(calls: ViewCalls, viewId: string, options: CallOptions): Promise<[number, readonly JsonValue[]]> {
    const history: JsonObject = await calls.sendAsync(viewId, Resources.getNavigationHistoryMethod, {}, options);
    const current: JsonValue | undefined = history[Resources.currentIndexField];
    const entries: JsonValue | undefined = history[Resources.entriesField];
    if (typeof current !== "number" || !JsonShapes.isArray(entries))
      throw new MalformedReplyException();
    return [current, entries];
  }

  protected static readEntryUrl(entry: JsonValue): string {
    const url: JsonValue | undefined = JsonShapes.isObject(entry) ? entry[Resources.urlField] : undefined;
    if (typeof url !== "string")
      throw new MalformedReplyException();
    return url;
  }
}

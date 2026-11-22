/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { MalformedReplyException } from "../exceptions/malformed-reply.exception.ts";
import type { CallOptions } from "../models/call-options.ts";
import { OriginPage } from "../models/origin-page.ts";
import { ShownPage } from "../models/shown-page.ts";
import { Resources } from "../resources.ts";
import type { JsonObject, JsonValue } from "../types/json-value.ts";
import { JsonShapes } from "./json-shapes.ts";
import { PageOrigin } from "./page-origin.ts";
import type { ViewCalls } from "./view-calls.ts";

// Reads the page a view shows from its history's current entry. The engine answers that itself, so it answers while the main frame waits
// for the next document's answer, when every call the page itself answers waits for that document, as long as the host relays the
// engine's answer at once, which Noldova Desktop's relay does only with the fix for noldova-com/desktop#523.
export class HistoryPageReader {
  public static async readAsync(calls: ViewCalls, viewId: string, options: CallOptions): Promise<OriginPage> {
    const history: JsonObject = await calls.sendAsync(viewId, Resources.getNavigationHistoryMethod, {}, options);
    const index: JsonValue | undefined = history[Resources.currentIndexField];
    const entries: JsonValue | undefined = history[Resources.entriesField];
    const entry: JsonValue | undefined = Object.isNumber(index) && JsonShapes.isArray(entries) ? entries[index] : undefined;
    if (!JsonShapes.isObject(entry))
      throw new MalformedReplyException();
    const url: JsonValue | undefined = entry[Resources.urlField];
    const title: JsonValue | undefined = entry[Resources.titleField];
    if (!Object.isString(url) || !Object.isString(title))
      throw new MalformedReplyException();
    return new OriginPage(PageOrigin.of(URL.parse(url)?.origin ?? Resources.opaqueOrigin), new ShownPage(url, title));
  }
}

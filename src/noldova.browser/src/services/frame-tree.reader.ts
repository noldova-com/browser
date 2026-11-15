/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { MalformedReplyException } from "../exceptions/malformed-reply.exception.ts";
import { FrameFacts } from "../models/frame-facts.ts";
import { Resources } from "../resources.ts";
import type { JsonObject, JsonValue } from "../types/json-value.ts";
import { JsonShapes } from "./json-shapes.ts";
import { PageOrigin } from "./page-origin.ts";

export class FrameTreeReader {
  public static read(reply: JsonObject): FrameFacts {
    const tree: JsonValue | undefined = reply[Resources.frameTreeField];
    const frame: JsonValue | undefined = JsonShapes.isObject(tree) ? tree[Resources.frameField] : undefined;
    if (!JsonShapes.isObject(frame))
      throw new MalformedReplyException();
    const url: JsonValue | undefined = frame[Resources.urlField];
    const origin: JsonValue | undefined = frame[Resources.securityOriginField];
    const documentId: JsonValue | undefined = frame[Resources.loaderIdField];
    if (typeof url !== "string" || typeof origin !== "string" || typeof documentId !== "string")
      throw new MalformedReplyException();
    return new FrameFacts(url, PageOrigin.of(origin), documentId);
  }
}

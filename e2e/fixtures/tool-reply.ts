/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonObject, JsonValue } from "@noldova/context.json";

// The agent double's callTool reply, a tool result with its content's parts.
export class ToolReply {
  // The reply's content parts that are objects, in order; a reply with no content gives none.
  public static partsOf(result: JsonValue): readonly JsonObject[] {
    const content: JsonValue | undefined = ToolReply.isJsonObject(result) ? result["content"] : undefined;
    return (Array.isArray(content) ? content : []).filter((t: JsonValue): t is JsonObject => ToolReply.isJsonObject(t));
  }

  // The text of each part that has one, in order, leaving out parts such as images.
  public static textsOf(result: JsonValue): string[] {
    return ToolReply.partsOf(result).map(t => t["text"]).filter((t): t is string => Object.isString(t));
  }

  // The parts' texts, one per line; a reply with no text gives "".
  public static textOf(result: JsonValue): string {
    return ToolReply.textsOf(result).join("\n");
  }

  private static isJsonObject(value: JsonValue | undefined): value is JsonObject {
    return Object.isObject(value) && !Array.isArray(value);
  }
}

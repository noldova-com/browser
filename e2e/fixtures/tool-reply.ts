/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonObject, JsonValue } from "@noldova/context.json";

// The agent double's callTool reply, a tool result with its content's text parts.
export class ToolReply {
  // The text of each of the reply's content parts, one per line; a part with no text gives an empty line, and a reply with no content gives "".
  public static textOf(result: JsonValue): string {
    const content: JsonValue | undefined = ToolReply.objectOf(result)?.["content"];
    return (Array.isArray(content) ? content : []).map((t: JsonValue) => {
      const text: JsonValue | undefined = ToolReply.objectOf(t)?.["text"];
      return Object.isString(text) ? text : "";
    }).join("\n");
  }

  private static isJsonObject(value: JsonValue | undefined): value is JsonObject {
    return Object.isObject(value) && !Array.isArray(value);
  }

  private static objectOf(value: JsonValue | undefined): JsonObject | null {
    return ToolReply.isJsonObject(value) ? value : null;
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject, JsonValue } from "../types/json-value.ts";

export class JsonShapes {
  public static isObject(value: JsonValue | undefined): value is JsonObject {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  public static isArray(value: JsonValue | undefined): value is readonly JsonValue[] {
    return Array.isArray(value);
  }
}

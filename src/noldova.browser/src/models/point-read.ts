/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "../types/json-value.ts";

// An element's first box, or null for one with none, and the page's layout metrics, read together.
export class PointRead {
  public readonly quad: readonly number[] | null;
  public readonly metrics: JsonObject;

  public constructor(quad: readonly number[] | null, metrics: JsonObject) {
    this.quad = quad;
    this.metrics = metrics;
  }
}

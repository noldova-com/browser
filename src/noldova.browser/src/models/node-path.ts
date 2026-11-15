/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "../types/json-value.ts";

export class NodePath {
  public readonly node: JsonObject;
  public readonly ancestors: readonly JsonObject[];

  public constructor(node: JsonObject, ancestors: readonly JsonObject[]) {
    this.node = node;
    this.ancestors = ancestors;
  }
}

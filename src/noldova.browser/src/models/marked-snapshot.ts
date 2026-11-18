/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "../types/json-value.ts";

// The snapshot function's answer, with the hosts of closed shadow roots it was given, in the order its lines number them.
export class MarkedSnapshot {
  public readonly reply: JsonObject;
  public readonly hosts: readonly number[];

  public constructor(reply: JsonObject, hosts: readonly number[]) {
    this.reply = reply;
    this.hosts = hosts;
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { AllowedMethod } from "../types/allowed-method.ts";
import type { JsonObject } from "../types/json-value.ts";

export class KeptCall {
  private sent: boolean = false;
  public readonly method: AllowedMethod;
  public readonly params: JsonObject;

  public constructor(method: AllowedMethod, params: JsonObject) {
    this.method = method;
    this.params = params;
  }

  public get isSent(): boolean {
    return this.sent;
  }

  public markSent(): void {
    this.sent = true;
  }

  public markUnsent(): void {
    this.sent = false;
  }
}

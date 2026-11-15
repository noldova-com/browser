/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { TypedAddressRefusal } from "@noldova/browser.protocol";
import { ToolFailureCode } from "@noldova/desktop.runtime";

import { Resources } from "../resources.ts";
import { CallFailureException } from "./call-failure.exception.ts";

export class AddressRefusedException extends CallFailureException {
  public override readonly reason: ToolFailureCode = ToolFailureCode.Refused;
  public override readonly moduleCode: string | null = Resources.originRefusedCode;
  public readonly refusal: TypedAddressRefusal;

  public constructor(refusal: TypedAddressRefusal) {
    super(Resources.formatAddressRefused(refusal));

    this.refusal = refusal;
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ToolFailureCode } from "@noldova/desktop.runtime";

import { Resources } from "../resources.ts";
import { CallFailureException } from "./call-failure.exception.ts";

export class ElementCoveredException extends CallFailureException {
  public override readonly reason: ToolFailureCode = ToolFailureCode.Refused;
  public override readonly moduleCode: string | null = Resources.coveredCode;

  public constructor() {
    super(Resources.covered);
  }
}

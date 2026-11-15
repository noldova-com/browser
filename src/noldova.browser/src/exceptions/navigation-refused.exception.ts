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

export class NavigationRefusedException extends CallFailureException {
  public override readonly reason: ToolFailureCode = ToolFailureCode.Refused;
  public override readonly moduleCode: string | null = null;
  public readonly origin: string | null;

  public constructor(origin: string | null) {
    super(Resources.formatRefused(origin));

    this.origin = origin;
  }
}

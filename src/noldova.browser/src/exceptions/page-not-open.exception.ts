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

export class PageNotOpenException extends CallFailureException {
  public override readonly reason: ToolFailureCode = ToolFailureCode.Unavailable;
  public override readonly moduleCode: string | null = Resources.viewClosedCode;
  public readonly instance: string;

  public constructor(instance: string) {
    super(Resources.pageNotOpen);

    this.instance = instance;
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { CallDeniedException } from "./call-denied.exception.ts";

export class HandedOverException extends CallDeniedException {
  public override readonly moduleCode: string | null = Resources.handedOverCode;

  public constructor() {
    super(Resources.handedOver);
  }
}

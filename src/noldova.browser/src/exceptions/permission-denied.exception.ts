/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { CallDeniedException } from "./call-denied.exception.ts";

export class PermissionDeniedException extends CallDeniedException {
  public override readonly moduleCode: string | null = null;

  public constructor() {
    super(Resources.denied);
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { CallTooLargeException } from "./call-too-large.exception.ts";

export class ResultTooLargeException extends CallTooLargeException {
  public constructor() {
    super(Resources.resultTooLarge);
  }
}

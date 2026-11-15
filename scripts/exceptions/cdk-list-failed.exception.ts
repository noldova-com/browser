/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { ProcessException } from "./process.exception.ts";

export class CdkListFailedException extends ProcessException {
  public readonly code: string;
  public readonly summary: string;

  public constructor(code: string, summary: string) {
    super(Resources.formatCdkListFailed(code, summary));

    this.code = code;
    this.summary = summary;
  }
}

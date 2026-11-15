/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { BrowserRuntimeException } from "./browser-runtime.exception.ts";

export class TypedRedirectAfterAgentException extends BrowserRuntimeException {
  public readonly instance: string;

  public constructor(instance: string) {
    super(Resources.typedRedirectAfterAgent);

    this.instance = instance;
  }
}

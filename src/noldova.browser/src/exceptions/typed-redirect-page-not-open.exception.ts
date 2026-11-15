/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { BrowserRuntimeException } from "./browser-runtime.exception.ts";

export class TypedRedirectPageNotOpenException extends BrowserRuntimeException {
  public readonly instance: string;
  public readonly profileKey: string;

  public constructor(instance: string, profileKey: string) {
    super(Resources.typedRedirectPageNotOpen);

    this.instance = instance;
    this.profileKey = profileKey;
  }
}

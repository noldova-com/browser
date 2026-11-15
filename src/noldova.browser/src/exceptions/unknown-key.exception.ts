/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { InvalidInputException } from "./invalid-input.exception.ts";

export class UnknownKeyException extends InvalidInputException {
  public readonly key: string;

  public constructor(key: string) {
    super(Resources.formatUnknownKey(key));

    this.key = key;
  }
}

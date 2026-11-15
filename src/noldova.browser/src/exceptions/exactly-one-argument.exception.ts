/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { InvalidInputException } from "./invalid-input.exception.ts";

export class ExactlyOneArgumentException extends InvalidInputException {
  public readonly names: readonly string[];

  public constructor(names: readonly string[]) {
    super(Resources.formatExactlyOne(names));

    this.names = names;
  }
}

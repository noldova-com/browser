/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { InvalidInputException } from "./invalid-input.exception.ts";

export class ArgumentMissingException extends InvalidInputException {
  public readonly argument: string;

  public constructor(argument: string) {
    super(Resources.formatMissing(argument));

    this.argument = argument;
  }
}

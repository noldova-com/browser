/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { InvalidInputException } from "./invalid-input.exception.ts";

export class ArgumentTooLargeException extends InvalidInputException {
  public readonly argument: string;
  public readonly maximum: number;

  public constructor(argument: string, maximum: number) {
    super(Resources.formatTooMuch(argument, maximum));

    this.argument = argument;
    this.maximum = maximum;
  }
}

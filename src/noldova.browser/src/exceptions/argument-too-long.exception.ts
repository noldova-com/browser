/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { InvalidInputException } from "./invalid-input.exception.ts";

export class ArgumentTooLongException extends InvalidInputException {
  public readonly argument: string;
  public readonly maximumLength: number;

  public constructor(argument: string, maximumLength: number) {
    super(Resources.formatTooLong(argument, maximumLength));

    this.argument = argument;
    this.maximumLength = maximumLength;
  }
}

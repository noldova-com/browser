/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { InvalidInputException } from "./invalid-input.exception.ts";

export class ArgumentNotOneOfException extends InvalidInputException {
  public readonly argument: string;
  public readonly values: readonly string[];

  public constructor(argument: string, values: readonly string[]) {
    super(Resources.formatNotOneOf(argument, values));

    this.argument = argument;
    this.values = values;
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class MissingPartError extends Error {
  public override readonly name: string = "MissingPartError";

  public constructor(part: string) {
    super(`The test has no ${part}.`);
  }
}

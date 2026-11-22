/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

// Console lines in a row from one origin, which a read returns as one piece of that origin's content.
export class ConsoleRun {
  public readonly origin: string;
  public readonly lines: string[];

  public constructor(origin: string, line: string) {
    this.origin = origin;
    this.lines = [line];
  }
}

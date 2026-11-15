/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class TypedLoad {
  private redirects: number = 0;
  private waiting: number = 1;

  public readonly entry: object;

  public constructor(entry: object) {
    this.entry = entry;
  }

  public get hops(): number {
    return this.redirects;
  }

  public get isAnswered(): boolean {
    return this.waiting === 0;
  }

  public follow(): void {
    this.redirects++;
    this.waiting++;
  }

  public answer(): void {
    this.waiting--;
  }
}

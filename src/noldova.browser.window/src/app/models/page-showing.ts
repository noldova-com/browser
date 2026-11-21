/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class PageShowing {
  private isClosed: boolean = false;

  public readonly instance: string;

  public constructor(instance: string) {
    this.instance = instance;
  }

  public get isClosedMeanwhile(): boolean {
    return this.isClosed;
  }

  public close(): void {
    this.isClosed = true;
  }
}

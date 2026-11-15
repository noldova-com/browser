/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ActionProgress {
  private readonly onSending: () => void;
  private granted: boolean = false;
  private inputSent: boolean = false;

  public constructor(onSending: () => void) {
    this.onSending = onSending;
  }

  public get isGranted(): boolean {
    return this.granted;
  }

  public get isInputSent(): boolean {
    return this.inputSent;
  }

  public markGranted(): void {
    this.granted = true;
  }

  public markInputSent(): void {
    if (this.inputSent)
      return;
    this.onSending();
    this.inputSent = true;
  }
}

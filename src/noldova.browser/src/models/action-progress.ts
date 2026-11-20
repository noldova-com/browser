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
  private onlyFocusSent: boolean = false;

  public constructor(onSending: () => void) {
    this.onSending = onSending;
  }

  public get isGranted(): boolean {
    return this.granted;
  }

  public get isInputSent(): boolean {
    return this.inputSent;
  }

  // Whether every input sent so far only moved the focus, so the action's own input, such as its text, hasn't reached the page.
  public get isOnlyFocusSent(): boolean {
    return this.onlyFocusSent;
  }

  public markGranted(): void {
    this.granted = true;
  }

  public markInputSent(isFocus: boolean = false): void {
    if (this.inputSent) {
      this.onlyFocusSent &&= isFocus;
      return;
    }
    this.onSending();
    this.inputSent = true;
    this.onlyFocusSent = isFocus;
  }
}

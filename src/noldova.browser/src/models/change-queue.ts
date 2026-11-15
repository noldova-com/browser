/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";

export class ChangeQueue {
  private readonly signal: AbortSignal;
  private isChanged: boolean = true;
  private isFirst: boolean = true;
  private wake: (() => void) | null = null;

  public constructor(signal: AbortSignal) {
    this.signal = signal;
    signal.addEventListener("abort", () => this.wake?.(), { once: true });
  }

  public add(): void {
    this.isChanged = true;
    this.wake?.();
  }

  public async nextAsync(): Promise<boolean> {
    if (!this.isFirst && !this.signal.aborted)
      await this.pauseAsync();
    this.isFirst = false;
    if (!this.isChanged && !this.signal.aborted)
      await new Promise<void>(resolve => {
        this.wake = resolve;
      });
    this.wake = null;
    if (this.signal.aborted)
      return false;
    this.isChanged = false;
    return true;
  }

  private pauseAsync(): Promise<void> {
    return new Promise<void>(resolve => {
      const end = (): void => {
        clearTimeout(timer);
        this.signal.removeEventListener("abort", end);
        resolve();
      };
      const timer: ReturnType<typeof setTimeout> = setTimeout(end, Resources.gapMilliseconds);
      this.signal.addEventListener("abort", end, { once: true });
    });
  }
}

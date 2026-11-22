/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

// Whether a view's main frame waits for the next document of a navigation, from the navigation's start until the frame committed a
// document or the navigation ended without one.
export class PendingNavigation {
  private ends: PromiseWithResolvers<void> = Promise.withResolvers<void>();
  private starts: PromiseWithResolvers<void> = Promise.withResolvers<void>();
  private isWaiting: boolean = false;
  private mainFrameId: string;

  public constructor(frameId: string) {
    this.mainFrameId = frameId;
  }

  public get frameId(): string {
    return this.mainFrameId;
  }

  public get isPending(): boolean {
    return this.isWaiting;
  }

  // Settles once no navigation is pending, at once when none is.
  public get ended(): Promise<void> {
    return this.isWaiting ? this.ends.promise : Promise.resolve();
  }

  // Settles at the next navigation's start.
  public get started(): Promise<void> {
    return this.starts.promise;
  }

  // A read of the frame tree names the main frame, which a view can replace, as when its page crashed.
  public rename(frameId: string): void {
    this.mainFrameId = frameId;
  }

  public start(): void {
    if (!this.isWaiting) {
      this.isWaiting = true;
      this.ends = Promise.withResolvers<void>();
    }
    this.starts.resolve();
    this.starts = Promise.withResolvers<void>();
  }

  public end(): void {
    if (!this.isWaiting)
      return;
    this.isWaiting = false;
    this.ends.resolve();
  }
}

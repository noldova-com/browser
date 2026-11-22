/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

// The listeners the fixture took from the process, and its own listener in their place.
class TakenListeners {
  public readonly kept: readonly NodeJS.UnhandledRejectionListener[];
  public readonly own: NodeJS.UnhandledRejectionListener;

  public constructor(kept: readonly NodeJS.UnhandledRejectionListener[], own: NodeJS.UnhandledRejectionListener) {
    this.kept = kept;
    this.own = own;
  }
}

// Takes the process's next unhandled rejection in place of Vitest's own listeners, which fail the run on one, and gives those listeners
// back once it came, or once the test stops it, so a test can expect a bug that a promise nobody awaits rethrows.
export class UnhandledRejections {
  private static readonly EVENT: "unhandledRejection" = "unhandledRejection";
  private static taken: TakenListeners | null = null;

  public static nextAsync(): Promise<unknown> {
    UnhandledRejections.stop();
    const kept: readonly NodeJS.UnhandledRejectionListener[] = process.listeners(UnhandledRejections.EVENT);
    process.removeAllListeners(UnhandledRejections.EVENT);
    const next: PromiseWithResolvers<unknown> = Promise.withResolvers<unknown>();
    const own: NodeJS.UnhandledRejectionListener = (reason: unknown) => {
      UnhandledRejections.stop();
      next.resolve(reason);
    };
    UnhandledRejections.taken = new TakenListeners(kept, own);
    process.on(UnhandledRejections.EVENT, own);
    return next.promise;
  }

  // Puts back the listeners it took when no rejection came, such as after a test that failed waiting for one.
  public static stop(): void {
    const taken: TakenListeners | null = UnhandledRejections.taken;
    if (Object.isNull(taken))
      return;
    UnhandledRejections.taken = null;
    process.off(UnhandledRejections.EVENT, taken.own);
    for (const listener of taken.kept)
      process.on(UnhandledRejections.EVENT, listener);
  }
}

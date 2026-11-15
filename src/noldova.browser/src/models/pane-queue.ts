/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class PaneQueue {
  private readonly tails: Map<string, Promise<void>> = new Map();

  public async runAsync<T>(viewId: string, work: () => Promise<T>): Promise<T> {
    const result: Promise<T> = (this.tails.get(viewId) ?? Promise.resolve()).then(work);
    const tail: Promise<void> = result.then(PaneQueue.settle, PaneQueue.settle);
    this.tails.set(viewId, tail);
    try {
      return await result;
    }
    finally {
      if (this.tails.get(viewId) === tail)
        this.tails.delete(viewId);
    }
  }

  private static settle(): void {
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { once } from "node:events";

export class AnswerLimit {
  // Settles as the answer does, or fails once the limit ends without one, naming what was asked, so a test whose app never answers
  // fails with that rather than only at its own timeout.
  public static async withinAsync<T>(answer: Promise<T>, limit: AbortSignal, asked: string): Promise<T> {
    const stopper = new AbortController();
    try {
      return await Promise.race([answer, once(limit, "abort", { signal: stopper.signal }).then((): never => {
        throw new Error(`${asked} got no answer within its limit.`);
      })]);
    }
    finally {
      stopper.abort();
    }
  }
}

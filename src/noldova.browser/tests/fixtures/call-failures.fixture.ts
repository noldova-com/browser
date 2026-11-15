/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { expect } from "vitest";

export class CallFailures {
  public static async expectAsync(running: Promise<unknown>, type: abstract new (...args: never[]) => Error, facts: object = {}): Promise<void> {
    const failure: unknown = await running.then(() => expect.fail("The call succeeded."), (error: unknown) => error);
    expect(failure).toBeInstanceOf(type);
    expect(failure).toMatchObject(facts);
  }
}

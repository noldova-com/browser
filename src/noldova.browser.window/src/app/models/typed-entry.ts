/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { EntryAnswer } from "../enums/entry-answer.ts";

export class TypedEntry {
  private readonly answer: PromiseWithResolvers<EntryAnswer> = Promise.withResolvers<EntryAnswer>();

  public get left(): Promise<EntryAnswer> {
    return this.answer.promise;
  }

  public end(): void {
    this.answer.resolve(EntryAnswer.Left);
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { getEventListeners } from "node:events";

import { describe, expect, it } from "vitest";

import { AnswerLimit } from "../fixtures/answer-limit.ts";

describe("AnswerLimit", () => {
  it("gives the answer that comes within the limit, and stops listening to the limit then", async () => {
    const limit = new AbortController();

    const answered = await AnswerLimit.withinAsync(Promise.resolve("answer"), limit.signal, "agent-double.callTool");

    expect([answered, getEventListeners(limit.signal, "abort")]).toEqual(["answer", []]);
  });

  it("passes on the answer's own failure", async () => {
    const failure = new Error("The app closed.");

    await expect(AnswerLimit.withinAsync(Promise.reject(failure), new AbortController().signal, "agent-double.callTool")).rejects.toBe(failure);
  });

  it("fails naming what was asked once the limit ends without an answer", async () => {
    const limit = new AbortController();
    const waiting = AnswerLimit.withinAsync(new Promise<never>(() => undefined), limit.signal, "agent-double.callTool");

    limit.abort();

    await expect(waiting).rejects.toThrow("agent-double.callTool got no answer within its limit.");
  });
});

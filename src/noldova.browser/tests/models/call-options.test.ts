/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { ActionProgress } from "../../src/models/action-progress.ts";
import { CallOptions } from "../../src/models/call-options.ts";

describe("CallOptions", () => {
  const SIGNAL: AbortSignal = new AbortController().signal;
  const PROGRESS: ActionProgress = new ActionProgress(() => undefined);
  const OPTIONS: CallOptions = new CallOptions(SIGNAL, 5_000, 1_000, true, PROGRESS);

  function fieldsOf(options: CallOptions): unknown[] {
    return [options.signal, options.deadline, options.maximumReplyBytes, options.isReferenced, options.progress];
  }

  it("keeps its fields", () => {
    expect(fieldsOf(OPTIONS)).toEqual([SIGNAL, 5_000, 1_000, true, PROGRESS]);
  });

  it("gives the same options with another signal and deadline", () => {
    const other: AbortSignal = new AbortController().signal;

    expect(fieldsOf(OPTIONS.withSignal(other, 9_000))).toEqual([other, 9_000, 1_000, true, PROGRESS]);
    expect(OPTIONS.withSignal(other, 9_000).signal).toBe(other);
  });

  it("gives the same options with another deadline", () => {
    expect(fieldsOf(OPTIONS.withDeadline(7_000))).toEqual([SIGNAL, 7_000, 1_000, true, PROGRESS]);
  });

  it("gives the same options with another reply limit", () => {
    expect(fieldsOf(OPTIONS.withMaximumReplyBytes(100_000))).toEqual([SIGNAL, 5_000, 100_000, true, PROGRESS]);
  });

  it("gives the same options with another progress", () => {
    const other: ActionProgress = new ActionProgress(() => undefined);

    expect(fieldsOf(OPTIONS.withProgress(other))).toEqual([SIGNAL, 5_000, 1_000, true, other]);
    expect(OPTIONS.withProgress(other).progress).toBe(other);
  });
});

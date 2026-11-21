/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { ActionProgress } from "../../src/models/action-progress.ts";

describe("ActionProgress", () => {
  it("starts with nothing granted or sent, and keeps each mark once made", () => {
    let sendings: number = 0;
    const progress: ActionProgress = new ActionProgress(() => sendings++);
    expect([progress.isGranted, progress.isInputSent]).toEqual([false, false]);

    progress.markGranted();

    expect([progress.isGranted, progress.isInputSent]).toEqual([true, false]);
    expect(sendings).toBe(0);
    progress.markInputSent();
    progress.markInputSent();
    expect([progress.isGranted, progress.isInputSent]).toEqual([true, true]);
    expect(sendings).toBe(1);
  });

  it("notes whether every input sent so far only moved the focus", () => {
    const focused: ActionProgress = new ActionProgress(() => undefined);
    const typed: ActionProgress = new ActionProgress(() => undefined);
    const pressed: ActionProgress = new ActionProgress(() => undefined);
    expect(focused.isOnlyFocusSent).toBe(false);

    focused.markInputSent(true);
    focused.markInputSent(true);
    typed.markInputSent(true);
    typed.markInputSent();
    typed.markInputSent(true);
    pressed.markInputSent();
    pressed.markInputSent(true);

    expect([focused, typed, pressed].map(t => t.isOnlyFocusSent)).toEqual([true, false, false]);
  });
});

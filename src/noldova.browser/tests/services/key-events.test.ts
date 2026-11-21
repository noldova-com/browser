/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { KeyDefinition } from "../../src/models/key-definition.ts";
import { KeyPress } from "../../src/models/key-press.ts";
import { KeyEvents } from "../../src/services/key-events.ts";
import type { KeyEvent } from "../../src/types/key-event.ts";

describe("KeyEvents", () => {
  it("finds named keys, letters, digits and any other single character, and no longer text", () => {
    expect(KeyEvents.find("Enter")).toStrictEqual(new KeyDefinition("Enter", "Enter", 13, "\r"));
    expect(KeyEvents.find("F1")).toStrictEqual(new KeyDefinition("F1", "F1", 112, ""));
    expect(KeyEvents.find("F13")).toBeNull();
    expect(KeyEvents.find("F12")).toStrictEqual(new KeyDefinition("F12", "F12", 123, ""));
    expect(KeyEvents.find("ArrowDown")).toStrictEqual(new KeyDefinition("ArrowDown", "ArrowDown", 40, ""));
    expect(KeyEvents.find("b")).toStrictEqual(new KeyDefinition("b", "KeyB", 66, "b"));
    expect(KeyEvents.find("7")).toStrictEqual(new KeyDefinition("7", "Digit7", 55, "7"));
    expect(KeyEvents.find("é")).toStrictEqual(new KeyDefinition("é", "", 0, "é"));
    expect(KeyEvents.find("\u{1f600}")).toStrictEqual(new KeyDefinition("\u{1f600}", "", 0, "\u{1f600}"));
    expect(KeyEvents.find("ab")).toBeNull();
  });

  it("adds the modifiers' bits, and none for a name it doesn't know", () => {
    expect([KeyEvents.readBits([]), KeyEvents.readBits(["Alt", "Control", "Meta", "Shift"]), KeyEvents.readBits(["Hyper"])]).toEqual([0, 15, 0]);
  });

  it("presses a typing key with its text, a named key without, and a shortcut without text even when Shift is held too, with Shift's capital", () => {
    expect(KeyEvents.press(new KeyDefinition("Enter", "Enter", 13, "\r"), 8).down).toEqual({ type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, modifiers: 8, text: "\r", unmodifiedText: "\r" });
    expect(KeyEvents.press(new KeyDefinition("Tab", "Tab", 9, ""), 0).down["type"]).toBe("rawKeyDown");
    expect(KeyEvents.press(new KeyDefinition("a", "KeyA", 65, "a"), 1 | 8)).toStrictEqual(new KeyPress(
      { type: "rawKeyDown", key: "A", code: "KeyA", windowsVirtualKeyCode: 65, modifiers: 9 },
      { type: "keyUp", key: "A", code: "KeyA", windowsVirtualKeyCode: 65, modifiers: 9 }
    ));
  });

  it("gives a letter under Shift its capital, in its key and its text, and leaves a digit, a sign and a named key as they are", () => {
    const down = (key: string): readonly (string | undefined)[] => {
      const event: KeyEvent = KeyEvents.press(KeyEvents.find(key) ?? new KeyDefinition(key, "", 0, ""), 8).down;
      return [event.key, event.code, event.text ?? ""];
    };

    expect(["a", "Z", "1", "-", "Tab", "é"].map(down)).toEqual([["A", "KeyA", "A"], ["Z", "KeyZ", "Z"], ["1", "Digit1", "1"], ["-", "", "-"], ["Tab", "Tab", ""], ["é", "", "é"]]);
  });
});

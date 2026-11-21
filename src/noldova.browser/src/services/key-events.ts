/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { KeyDefinition } from "../models/key-definition.ts";
import { KeyPress } from "../models/key-press.ts";
import { Resources } from "../resources.ts";
import type { KeyEvent } from "../types/key-event.ts";

export class KeyEvents {
  private static readonly NAMED: ReadonlyMap<string, KeyDefinition> = new Map([
    ...Resources.namedKeys,
    ...Array.from({ length: Resources.functionKeyCount }, (_value: unknown, index: number): KeyDefinition => {
      const key: string = Resources.formatFunctionKey(index + 1);
      return new KeyDefinition(key, key, Resources.firstFunctionKeyCode + index, "");
    })
  ].map(t => [t.key, t]));

  public static find(key: string): KeyDefinition | null {
    const named: KeyDefinition | undefined = KeyEvents.NAMED.get(key);
    if (named !== undefined)
      return named;
    if ([...key].length !== 1)
      return null;
    const upper: string = key.toUpperCase();
    if (Resources.letterKeyPattern.test(upper))
      return new KeyDefinition(key, Resources.formatLetterCode(upper), upper.charCodeAt(0), key);
    if (Resources.digitKeyPattern.test(key))
      return new KeyDefinition(key, Resources.formatDigitCode(key), key.charCodeAt(0), key);
    return new KeyDefinition(key, "", 0, key);
  }

  public static readBits(modifiers: readonly string[]): number {
    return modifiers.reduce((bits, t) => bits | (Resources.modifierBits.get(t) ?? 0), 0);
  }

  public static press(pressed: KeyDefinition, bits: number): KeyPress {
    const definition: KeyDefinition = (bits & Resources.shiftBit) === 0 ? pressed : KeyEvents.shifted(pressed);
    const fields: { key: string; code: string; windowsVirtualKeyCode: number; modifiers: number } = {
      key: definition.key, code: definition.code, windowsVirtualKeyCode: definition.keyCode, modifiers: bits
    };
    const text: string = (bits & Resources.shortcutBits) === 0 ? definition.text : "";
    const down: KeyEvent = text === "" ? { type: Resources.rawKeyDownType, ...fields } : { type: Resources.keyDownType, ...fields, text, unmodifiedText: text };
    return new KeyPress(down, { type: Resources.keyUpType, ...fields });
  }

  // Shift gives a letter its capital, as a keyboard does, in the key and the text it types, when the capital is one other code point, as for
  // ñ, ж or α. Any other key stays as it is: a digit's or a sign's shifted form depends on the keyboard's layout.
  private static shifted(definition: KeyDefinition): KeyDefinition {
    const upper: string = definition.key.toUpperCase();
    const isLetter: boolean = upper !== definition.key && [...definition.key].length === 1 && [...upper].length === 1;
    return isLetter ? new KeyDefinition(upper, definition.code, definition.keyCode, upper) : definition;
  }
}

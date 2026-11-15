/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { OutputLimits } from "../services/output-limits.ts";
import { BrowserLimits } from "./browser-limits.ts";
import type { ConsoleRing } from "./console-ring.ts";
import type { CutText } from "./cut-text.ts";

export abstract class ConsoleEvent {
  public abstract addTo(ring: ConsoleRing): void;

  protected static cut(text: string): string {
    const cut: CutText = OutputLimits.cutText(text, BrowserLimits.maximumConsoleEntryBytes);
    return cut.isCut ? `${cut.text}${Resources.consoleEntryCut}` : cut.text;
  }
}

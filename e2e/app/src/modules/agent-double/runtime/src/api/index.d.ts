/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IRuntimePart, IRuntimePartContext } from "@noldova/desktop.runtime";

/**
 * The agent double's runtime part: the browser's pages the end-to-end tests open, which it asks its window part to open, and one agent session whose tool calls, and the answers to their permission requests, the tests drive through its methods.
 */
export declare class RuntimePart implements IRuntimePart {
  /**
   * Registers the methods, the page-opening event and the permission answerer.
   */
  public activateAsync(context: IRuntimePartContext): Promise<void>;

  /**
   * Ends the session and withdraws the answerer and the event.
   */
  public deactivateAsync(): Promise<void>;
}

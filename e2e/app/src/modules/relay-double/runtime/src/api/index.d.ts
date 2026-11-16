/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IRuntimePart, IRuntimePartContext } from "@noldova/desktop.runtime";

/**
 * The relay double's runtime part: its one web view, which it asks its window part to open, and the calls the end-to-end tests send through the base's relay, under the browser module's webViews.json.
 */
export declare class RuntimePart implements IRuntimePart {
  /**
   * Registers the methods and the opening event.
   */
  public activateAsync(context: IRuntimePartContext): Promise<void>;

  /**
   * Withdraws the opening event.
   */
  public deactivateAsync(): Promise<void>;
}

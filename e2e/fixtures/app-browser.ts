/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class AppBrowser {
  // The pane names the module as the app's browser, or as this browser while the app's name is unknown, so a test passes whichever app runs it.
  public static saying(rest: string): RegExp {
    return new RegExp(`^(?:This browser|.+'s browser) ${rest.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);
  }
}

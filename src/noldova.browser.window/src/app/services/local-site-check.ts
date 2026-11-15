/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { LocalSites } from "@noldova/browser.protocol";

import { Resources } from "../../resources.ts";

export class LocalSiteCheck {
  public static check(text: string): string | null {
    const refused: readonly string[] = LocalSites.read(text).ignoredEntries;
    return refused.length === 0 ? null : Resources.formatRefusedLocalSites(refused);
  }
}

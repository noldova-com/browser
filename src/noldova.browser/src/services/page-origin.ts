/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";

export class PageOrigin {
  public static of(securityOrigin: string): string {
    return URL.parse(securityOrigin)?.origin === securityOrigin ? securityOrigin : Resources.opaquePageOrigin;
  }
}

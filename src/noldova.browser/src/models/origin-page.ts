/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ShownPage } from "./shown-page.ts";

// A page a view shows, with the origin of its address.
export class OriginPage {
  public readonly origin: string;
  public readonly page: ShownPage;

  public constructor(origin: string, page: ShownPage) {
    this.origin = origin;
    this.page = page;
  }
}

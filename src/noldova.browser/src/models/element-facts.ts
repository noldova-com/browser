/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { NodeFacts } from "./node-facts.ts";
import type { PageFacts } from "./page-facts.ts";

export class ElementFacts {
  public readonly path: readonly NodeFacts[] | null;
  public readonly form: readonly NodeFacts[];
  public readonly page: PageFacts;

  public constructor(path: readonly NodeFacts[] | null, form: readonly NodeFacts[], page: PageFacts) {
    this.path = path;
    this.form = form;
    this.page = page;
  }
}

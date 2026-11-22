/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { MissingPartError } from "./missing-part.error.ts";

export class PagePartsFixture {
  public static find<T extends Element = Element>(root: ParentNode, selector: string): T {
    const part: T | null = root.querySelector<T>(selector);
    if (Object.isNull(part))
      throw new MissingPartError(`element at ${selector}`);
    return part;
  }
}

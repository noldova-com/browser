/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * The browser module's window part, which comes from its own package, `@noldova/browser.window`, that this package pins exactly.
 *
 * @example
 * ```ts
 * import { windowPart } from "@noldova/browser/window";
 *
 * console.log(windowPart.moduleId);
 * ```
 */
export { windowPart } from "@noldova/browser.window";

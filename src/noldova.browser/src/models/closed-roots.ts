/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

// The hosts of the document's closed shadow roots, and the names of the elements too large for the browser to describe, whose closed
// roots weren't searched.
export class ClosedRoots {
  public readonly hosts: number[] = [];
  public readonly unsearched: string[] = [];
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ElementReference } from "../models/element-reference.ts";
import type { SnapshotReference } from "../models/snapshot-reference.ts";

// What a caller does with a session's reference, for each kind of element it names: one the page's snapshot function kept, or one read
// inside a closed shadow root by its node.
export interface ISessionReferenceVisitor<T> {
  visitSnapshotElement(reference: SnapshotReference): T;
  visitClosedElement(reference: ElementReference): T;
}

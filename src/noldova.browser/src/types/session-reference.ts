/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ElementReference } from "../models/element-reference.ts";
import type { SnapshotReference } from "../models/snapshot-reference.ts";

// What a session's reference names: an element the page's snapshot function kept, or one read inside a closed shadow root, which the page
// can't keep, by its node.
export type SessionReference = SnapshotReference | ElementReference;

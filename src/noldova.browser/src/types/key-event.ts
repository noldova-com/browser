/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { CommandParams } from "./command-params.ts";
import type { JsonObject } from "./json-value.ts";

export type KeyEvent = CommandParams<"Input.dispatchKeyEvent"> & JsonObject;

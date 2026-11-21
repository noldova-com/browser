/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { TypedAddressAllowed } from "../models/typed-address-allowed.ts";
import type { TypedAddressLeft } from "../models/typed-address-left.ts";
import type { TypedAddressRefused } from "../models/typed-address-refused.ts";

export type TypedAddressAnswer = TypedAddressAllowed | TypedAddressRefused | TypedAddressLeft;

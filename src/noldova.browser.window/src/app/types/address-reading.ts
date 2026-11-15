/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { TypedAddressRefused } from "@noldova/browser.protocol";

import type { ReadAddress } from "../models/read-address.ts";

export type AddressReading = ReadAddress | TypedAddressRefused;

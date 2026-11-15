/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ProtocolMapping } from "devtools-protocol/types/protocol-mapping.js";

import type { AllowedMethod } from "./allowed-method.ts";

export type CommandParams<TMethod extends AllowedMethod> = ProtocolMapping.Commands[TMethod]["paramsType"] extends []
  ? Record<string, never>
  : NonNullable<ProtocolMapping.Commands[TMethod]["paramsType"][0]>;

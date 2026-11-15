/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TypedAddressRequest } from "@noldova/browser.protocol";

import { ProfileKeyInvalidException } from "../exceptions/profile-key-invalid.exception.ts";
import { Resources } from "../resources.ts";
import type { JsonValue } from "../types/json-value.ts";
import { WindowRequests } from "./window-requests.ts";

export class TypedAddressRequests {
  public static isProfileKey(value: string): boolean {
    return Resources.profileKeyPattern.test(value);
  }

  public static read(params: JsonValue): TypedAddressRequest {
    const request: TypedAddressRequest = WindowRequests.read(() => TypedAddressRequest.fromJson(params));
    TypedAddressRequests.checkProfileKey(request.profileKey);
    return request;
  }

  public static checkProfileKey(profileKey: string): void {
    if (!TypedAddressRequests.isProfileKey(profileKey))
      throw new ProfileKeyInvalidException();
  }
}

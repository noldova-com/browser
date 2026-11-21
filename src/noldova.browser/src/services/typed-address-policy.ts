/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { AddressKind, AddressKinds, TypedAddressAllowed, type TypedAddressAnswer, TypedAddressRefusal, TypedAddressRefused } from "@noldova/browser.protocol";

import { BrowserLimits } from "../models/browser-limits.ts";
import { Resources } from "../resources.ts";

export class TypedAddressPolicy {
  public static judge(url: string, settingsOrigins: readonly string[]): TypedAddressAnswer {
    if (url.length > BrowserLimits.maximumUrlLength)
      return new TypedAddressRefused(TypedAddressRefusal.TooLong);
    const parsed: URL | null = URL.parse(url);
    if (parsed === null)
      return new TypedAddressRefused(TypedAddressRefusal.NotAnAddress);
    if (!Resources.webSchemes.includes(parsed.protocol))
      return new TypedAddressRefused(TypedAddressRefusal.NotWeb);
    if (parsed.username !== "" || parsed.password !== "")
      return new TypedAddressRefused(TypedAddressRefusal.Credentials);
    if (Resources.wildcardPattern.test(parsed.hostname))
      return new TypedAddressRefused(TypedAddressRefusal.NotAnAddress);
    const kind: AddressKind = AddressKinds.ofHost(parsed.hostname);
    if (kind === AddressKind.LinkLocal || kind === AddressKind.Unspecified)
      return new TypedAddressRefused(TypedAddressRefusal.NeverAllowed);
    if (kind !== AddressKind.Public && !settingsOrigins.includes(parsed.origin))
      return new TypedAddressRefused(TypedAddressRefusal.Local);
    return new TypedAddressAllowed(parsed.origin);
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { AddressKinds, TypedAddressRefusal, TypedAddressRefused } from "@noldova/browser.protocol";

import { Resources } from "../../resources.ts";
import { ReadAddress } from "../models/read-address.ts";
import type { AddressReading } from "../types/address-reading.ts";

export class AddressReader {
  public static read(text: string, localSites: readonly string[]): AddressReading {
    const typed: string = text.trim();
    if (typed === "" || Resources.spacePattern.test(typed))
      return new TypedAddressRefused(TypedAddressRefusal.NotAnAddress);
    const colon: number = typed.indexOf(Resources.schemeEnd);
    const before: string = colon < 0 ? "" : typed.slice(0, colon);
    const name: string | null = Resources.schemePattern.test(before) && !Resources.portPattern.test(typed.slice(colon + 1)) ? before.toLowerCase() : null;
    if (name !== null && !Resources.webSchemeNames.includes(name))
      return new TypedAddressRefused(TypedAddressRefusal.NotWeb);
    const url: URL | null = URL.parse(name === null ? Resources.formatDefaultSchemeAddress(typed) : typed);
    if (url === null || (name === null && !AddressReader.isHost(url.hostname)))
      return new TypedAddressRefused(TypedAddressRefusal.NotAnAddress);
    return new ReadAddress(name === null ? new URL(`${AddressReader.schemeOf(typed, url.hostname, localSites)}${typed}`).href : url.href);
  }

  // The scheme of the single site the setting Sites on this computer or network names at the typed host and port, so a local server on https
  // isn't asked over http; otherwise http for a host browsers don't upgrade, and https for any other.
  private static schemeOf(typed: string, hostname: string, localSites: readonly string[]): string {
    const [named, ...others]: readonly string[] = Resources.typedSchemes.filter(t => localSites.includes(new URL(`${t}${typed}`).origin));
    if (named !== undefined && others.length === 0)
      return named;
    return AddressReader.isLocal(hostname) ? Resources.localScheme : Resources.defaultScheme;
  }

  private static isHost(hostname: string): boolean {
    return hostname.includes(Resources.hostLabelSeparator) || hostname === Resources.localName || hostname.startsWith(Resources.ipv6Opening);
  }

  // A host on this computer or its network, which browsers don't upgrade to https: a loopback or private address, or a name in `.local`.
  // A single-label name other than `localhost` isn't read as an address at all.
  private static isLocal(hostname: string): boolean {
    return Resources.httpAddressKinds.includes(AddressKinds.ofHost(hostname)) || hostname.replace(Resources.trailingDotsPattern, "").endsWith(Resources.networkNameSuffix);
  }
}

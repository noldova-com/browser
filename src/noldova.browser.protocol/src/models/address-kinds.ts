/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { AddressKind } from "../enums/address-kind.ts";
import { Resources } from "../resources.ts";

export class AddressKinds {
  public static ofHost(hostname: string): AddressKind {
    if (hostname.startsWith(Resources.ipv6Opening))
      return AddressKinds.ofIpv6(AddressKinds.readIpv6(hostname.slice(1, -1)));
    const host: string = hostname.replace(Resources.trailingDotsPattern, "");
    if (AddressKinds.isIpv4(host))
      return AddressKinds.ofIpv4(host.split(Resources.ipv4PartSeparator).reduce((value, t) => value * 256 + Number(t), 0));
    return host === Resources.loopbackName || host.endsWith(Resources.loopbackSuffix) ? AddressKind.Loopback : AddressKind.Public;
  }

  private static isIpv4(host: string): boolean {
    return Resources.ipv4Pattern.test(host) && host.split(Resources.ipv4PartSeparator).every(t => Number(t) <= Resources.ipv4PartMaximum);
  }

  private static ofIpv4(address: number): AddressKind {
    const a: number = address >>> 24;
    const b: number = (address >>> 16) & 0xff;
    if (a === 0)
      return AddressKind.Unspecified;
    if (a === Resources.ipv4LoopbackNetwork)
      return AddressKind.Loopback;
    if (Resources.ipv4PrivateRanges.some(t => AddressKinds.isInRange(a, b, t)))
      return AddressKind.Private;
    if (AddressKinds.isInRange(a, b, Resources.ipv4LinkLocalRange))
      return AddressKind.LinkLocal;
    return AddressKind.Public;
  }

  private static isInRange(a: number, b: number, range: readonly [number, number, number]): boolean {
    return a === range[0] && b >= range[1] && b <= range[2];
  }

  private static ofIpv6(address: bigint): AddressKind {
    if (address === 0n)
      return AddressKind.Unspecified;
    if (address === 1n)
      return AddressKind.Loopback;
    const prefix: bigint = address >> Resources.ipv4Bits;
    if (prefix === Resources.mappedPrefix || prefix === 0n || prefix === Resources.nat64Prefix)
      return AddressKinds.ofIpv4(Number(address & Resources.ipv4Mask));
    if (address >> Resources.uniqueLocalShift === Resources.uniqueLocalPrefix)
      return AddressKind.Private;
    if (address >> Resources.linkLocalShift === Resources.linkLocalPrefix)
      return AddressKind.LinkLocal;
    return AddressKind.Public;
  }

  private static readIpv6(address: string): bigint {
    const gap: number = address.indexOf(Resources.ipv6ZeroRun);
    const head: bigint[] = AddressKinds.readPieces(gap < 0 ? address : address.slice(0, gap));
    const tail: bigint[] = gap < 0 ? [] : AddressKinds.readPieces(address.slice(gap + Resources.ipv6ZeroRun.length));
    const pieces: bigint[] = [...head, ...new Array<bigint>(8 - head.length - tail.length).fill(0n), ...tail];
    return pieces.reduce((value, t) => (value << 16n) | t, 0n);
  }

  private static readPieces(text: string): bigint[] {
    return text === "" ? [] : text.split(Resources.ipv6PieceSeparator).map(t => BigInt(Resources.formatHexPiece(t)));
  }
}

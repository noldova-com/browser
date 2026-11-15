/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import type { AddressKind } from "../../src/enums/address-kind.ts";
import { AddressKinds } from "../../src/models/address-kinds.ts";

describe("AddressKinds", () => {
  function kindOf(host: string): AddressKind {
    return AddressKinds.ofHost(new URL(`http://${host}/`).hostname);
  }

  const ADDRESSES: readonly [string, AddressKind][] = [
    ["93.184.216.34", "Public"], ["0.0.0.0", "Unspecified"], ["0.1.2.3", "Unspecified"], ["127.0.0.1", "Loopback"], ["127.8.9.10", "Loopback"],
    ["10.1.2.3", "Private"], ["172.16.0.1", "Private"], ["172.31.255.255", "Private"], ["172.32.0.1", "Public"], ["172.15.0.1", "Public"],
    ["192.168.0.1", "Private"], ["192.169.0.1", "Public"], ["100.64.0.1", "Private"], ["100.127.255.255", "Private"], ["100.63.255.255", "Public"],
    ["100.128.0.1", "Public"], ["169.254.169.254", "LinkLocal"], ["169.255.0.1", "Public"], ["169.253.0.1", "Public"],
    ["[::]", "Unspecified"], ["[::1]", "Loopback"], ["[fc00::1]", "Private"], ["[FD12::1]", "Private"], ["[fe80::1]", "LinkLocal"], ["[febf::1]", "LinkLocal"],
    ["[fec0::1]", "Public"], ["[2001:db8::1]", "Public"], ["[1:2:3:4:5:6:7:8]", "Public"],
    ["[::ffff:127.0.0.1]", "Loopback"], ["[::ffff:7f00:1]", "Loopback"], ["[::FFFF:10.0.0.1]", "Private"], ["[::ffff:a9fe:a9fe]", "LinkLocal"], ["[::ffff:5db8:d822]", "Public"],
    ["[::7f00:1]", "Loopback"], ["[::c0a8:101]", "Private"], ["[::0.0.0.2]", "Unspecified"],
    ["[64:ff9b::7f00:1]", "Loopback"], ["[64:ff9b::6440:1]", "Private"], ["[64:ff9b::5db8:d822]", "Public"], ["[64:ff9b:1::7f00:1]", "Public"]
  ];

  it.each(ADDRESSES)("judges %s as %s", (host, kind) => {
    expect(kindOf(host)).toBe(kind);
  });

  it("judges the numeric forms of an IPv4 address as the four-part address the parser writes", () => {
    expect(["0x7f.1", "2130706433", "0177.0.0.1"].map(kindOf)).toEqual(["Loopback", "Loopback", "Loopback"]);
  });

  it("judges localhost and names under .localhost as loopback, trailing dots dropped, and every other name as public", () => {
    expect(["localhost", "LOCALHOST", "app.localhost", "localhost.", "localhost..", "a.b.localhost...", "localhost.example", "notlocalhost", "example.com", "example.com."].map(kindOf))
      .toEqual(["Loopback", "Loopback", "Loopback", "Loopback", "Loopback", "Loopback", "Public", "Public", "Public", "Public"]);
  });

  it("judges an IPv4 address with a trailing dot as that address", () => {
    expect(AddressKinds.ofHost("127.0.0.1.")).toBe("Loopback");
  });

  it("judges four numbers with a part above 255 as a name, not as an address", () => {
    expect(["383.0.0.1", "127.0.0.256", "383.0.0.1.."].map(t => AddressKinds.ofHost(t))).toEqual(["Public", "Public", "Public"]);
    expect(kindOf("383.0.0.1..")).toBe("Public");
  });
});

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { LocalSites } from "../../src/models/local-sites.ts";

describe("LocalSites", () => {
  it("reads exact origins separated by commas, ignoring blanks and spaces, a trailing slash, case, a default port and an origin given twice", () => {
    const sites: LocalSites = LocalSites.read(" http://127.0.0.1:4173 , , HTTP://LocalHost:3000/, https://192.168.1.20:443, http://127.0.0.1:4173/ ");

    expect([sites.origins, sites.ignored, sites.ignoredEntries]).toEqual([["http://127.0.0.1:4173", "http://localhost:3000", "https://192.168.1.20"], [], []]);
  });

  it("reads an empty text as no sites", () => {
    expect([LocalSites.read("").origins, LocalSites.read("").ignored]).toEqual([[], []]);
  });

  it.each([
    ["http://[::1]:4173", "http://[::1]:4173"],
    ["http://[0:0:0:0:0:0:0:1]:4173", "http://[::1]:4173"],
    ["http://[FD12::1]:8080", "http://[fd12::1]:8080"],
    ["http://[::ffff:127.0.0.1]:4173", "http://[::ffff:7f00:1]:4173"],
    ["http://2130706433:4173", "http://127.0.0.1:4173"],
    ["http://0x7f.0.0.1:4173", "http://127.0.0.1:4173"],
    ["http://0xC0A80114:8080", "http://192.168.1.20:8080"],
    ["http://0177.0.0.1:4173", "http://127.0.0.1:4173"],
    ["http://127.0.0.1.:4173", "http://127.0.0.1:4173"],
    ["http://localhost.:3000", "http://localhost.:3000"],
    ["http://app.localhost:3000", "http://app.localhost:3000"]
  ])("reads %j as %j", (entry, origin) => {
    expect([LocalSites.read(entry).origins, LocalSites.read(entry).ignored]).toEqual([[origin], []]);
  });

  it.each([
    ["127.0.0.1:4173", "no scheme"],
    ["http://127.0.0.1:4173/form", "a path"],
    ["http://127.0.0.1:4173/?q=1", "a query"],
    ["http://127.0.0.1:4173/#top", "a fragment"],
    ["http://user:secret@127.0.0.1:4173", "a user and password"],
    ["ftp://127.0.0.1", "another scheme"],
    ["http://169.254.169.254", "a link-local host"],
    ["http://[fe80::1]:3000", "a link-local IPv6 host"],
    ["http://[::ffff:169.254.1.1]", "a link-local host carried in IPv6"],
    ["http://0.0.0.0:8080", "an unspecified host"],
    ["http://0:8080", "an unspecified host in decimal"],
    ["http://[::]:3000", "an unspecified IPv6 host"],
    ["http://*.localhost:3000", "a wildcard"],
    ["http://%2A.localhost:3000", "an escaped wildcard"],
    ["http://127.0.0.1..:4173", "an IPv4 address with two trailing dots"],
    ["http://localhost..:4173", "localhost with two trailing dots"],
    ["http://a..localhost:3000", "an empty label inside the name"],
    ["http://.localhost:3000", "an empty first label"],
    ["http://383.0.0.1..:4173", "a part above 255"],
    ["http://server.local:5000", "a name on the network"],
    ["http://localhost.example:3000", "a public name that starts as localhost does"],
    ["https://93.184.216.34", "a public IP address"],
    ["http://[2001:db8::1]", "a public IPv6 address"],
    ["http://[::1", "an unclosed IPv6 host"],
    ["not an address", "no address at all"]
  ])("ignores %j, with %s, and keeps its place and text among the entries", entry => {
    const sites: LocalSites = LocalSites.read(`http://127.0.0.1:4173, , ${entry}, http://192.168.1.20:8080`);

    expect([sites.origins, sites.ignored, sites.ignoredEntries]).toEqual([["http://127.0.0.1:4173", "http://192.168.1.20:8080"], [2], [entry]]);
  });
});

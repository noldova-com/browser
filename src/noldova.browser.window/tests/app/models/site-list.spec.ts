/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { SiteList } from "../../../src/app/models/site-list.ts";

describe("SiteList", () => {
  it("reads hosts separated by commas, ignoring blanks and spaces, a leading \"*.\", case, a trailing dot and a host given twice", () => {
    const sites: SiteList = SiteList.read(" code.example,, *.Example.ORG ,\tdocs.example.net.,CODE.example, ");

    expect([sites.hosts, sites.ignored]).toEqual([["code.example", "example.org", "docs.example.net"], []]);
  });

  it("reads an empty text as no sites", () => {
    expect([SiteList.read("").hosts, SiteList.read(" , ").hosts]).toEqual([[], []]);
  });

  it("reads a host in another script as the URL parser's punycode, and an IPv4 address as itself", () => {
    expect(SiteList.read("bücher.example, 198.51.100.2").hosts).toEqual(["xn--bcher-kva.example", "198.51.100.2"]);
  });

  it.each([
    ["https://[::1]/", "a web address with an IPv6 host"],
    ["https://", "a web scheme with no host"],
    ["code example", "a space"],
    ["[::]", "an IPv6 address"],
    ["*.", "a wildcard alone"],
    [".code.example", "a leading dot"],
    ["code..example", "an empty label"],
    ["**.code.example", "a second wildcard"],
    ["exa<mple.com", "a character no host has"],
    ["1.2.3.256", "an IPv4 address out of range"],
    ["foo://1.2.3.256", "another scheme's host that is an IPv4 address out of range"]
  ])("ignores %j, with %s, and keeps its place among the entries", entry => {
    const sites: SiteList = SiteList.read(`code.example, , ${entry}, example.com`);

    expect([sites.hosts, sites.ignored, sites.ignoredEntries]).toEqual([["code.example", "example.com"], [2], [entry]]);
  });

  it.each([
    ["https://code.example/team", true],
    ["http://Code.example./a", true],
    ["https://api.code.example/", true],
    ["https://a.b.code.example:8443/x?y#z", true],
    ["https://user:@code.example/", true],
    ["https://evilcode.example/", false],
    ["https://code.example.evil.example/", false],
    ["https://code.exampl/", false],
    ["https://xcode.example/", false],
    ["https://example.com/code.example", false],
    ["https://example.com/?site=code.example", false],
    ["https://code.example:@evil.example/", false],
    ["not an address", false]
  ])("matches %j: %s", (url, isMatch) => {
    expect(SiteList.read("code.example").matches(url)).toBe(isMatch);
  });

  it("matches an address whose host is in another script by its punycode, and an IPv4 address only as itself", () => {
    const sites: SiteList = SiteList.read("bücher.example, 20.0.0.1");

    expect([
      sites.matches("https://bücher.example/"), sites.matches("https://shop.xn--bcher-kva.example/"), sites.matches("https://20.0.0.1/"),
      sites.matches("https://20.0.0.10/"), sites.matches("https://120.0.0.1/")
    ]).toEqual([true, true, true, false, false]);
  });

  it.each([
    ["code.example/team", "code.example", "a path"],
    ["code.example:443", "code.example", "a port"],
    ["localhost:3000", "localhost", "no scheme and a port"],
    ["user-1@host-1.example", "host-1.example", "a user"],
    ["a?b", "a", "a query"],
    ["a#b", "a", "a fragment"],
    ["a\\b", "a", "a backslash, which the URL parser reads as a path"],
    ["exa%41mple.com", "exaample.com", "an escape, which the URL parser decodes"],
    ["ftp://Code.example/x", "code.example", "a scheme that isn't the web's"],
    ["https://*.example.org/a", "example.org", "a web address whose host has a leading \"*.\""]
  ])("reads %j as its host %j, with %s", (entry, host) => {
    expect([SiteList.read(entry).hosts, SiteList.read(entry).ignored]).toEqual([[host], []]);
  });

  it("reads an http: or https: address as its host, so it matches that host and its subdomains and never every link", () => {
    const sites: SiteList = SiteList.read("https://example.com, http://Code.example./settings?tab=1, https://user@docs.example:8443/a");

    expect([sites.hosts, sites.ignored]).toEqual([["example.com", "code.example", "docs.example"], []]);
    expect([
      sites.matches("https://example.com/a"), sites.matches("https://www.example.com/"), sites.matches("https://api.code.example/"),
      sites.matches("https://other.example/"), sites.matches("https://evilexample.com/"), sites.matches("https://example.org/example.com")
    ]).toEqual([true, true, true, false, false, false]);
  });

  it("matches nothing with no sites", () => {
    expect(SiteList.read("").matches("https://code.example/")).toBe(false);
  });
});

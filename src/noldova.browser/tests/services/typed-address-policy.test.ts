/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { TypedAddressPolicy } from "../../src/services/typed-address-policy.ts";

describe("TypedAddressPolicy", () => {
  const SETTINGS: readonly string[] = ["http://localhost:3000", "https://intranet.example"];

  it("allows a public web address with its origin, as the URL standard writes it", () => {
    expect([
      TypedAddressPolicy.judge("https://Example.COM:443/docs?q=1", []),
      TypedAddressPolicy.judge("http://example.com:8080/", []),
      TypedAddressPolicy.judge("https://xn--bcher-kva.example/", [])
    ]).toEqual([
      { kind: "Allowed", origin: "https://example.com" },
      { kind: "Allowed", origin: "http://example.com:8080" },
      { kind: "Allowed", origin: "https://xn--bcher-kva.example" }
    ]);
  });

  it("refuses text that doesn't parse, a scheme other than http: or https:, and an address with a user name or password", () => {
    expect(["not a url", "file:///etc/hosts", "javascript:alert(1)", "ws://example.com/", "https://user@example.com/", "https://:secret@example.com/"]
      .map(t => TypedAddressPolicy.judge(t, []))).toEqual([
      { kind: "Refused", reason: "NotAnAddress" },
      { kind: "Refused", reason: "NotWeb" },
      { kind: "Refused", reason: "NotWeb" },
      { kind: "Refused", reason: "NotWeb" },
      { kind: "Refused", reason: "Credentials" },
      { kind: "Refused", reason: "Credentials" }
    ]);
  });

  it("refuses an address longer than the limit, and takes one at it", () => {
    const base: string = "https://example.com/";
    const atLimit: string = base + "a".repeat(32768 - base.length);

    expect([TypedAddressPolicy.judge(atLimit, []).kind, TypedAddressPolicy.judge(`${atLimit}a`, [])]).toEqual(["Allowed", { kind: "Refused", reason: "TooLong" }]);
  });

  it("refuses a loopback or private address unless the app's settings name its exact origin", () => {
    expect(["http://localhost:3000/app", "http://localhost:3001/", "http://127.0.0.1:3000/", "http://localhost.:3000/", "http://192.168.1.2/", "http://[::ffff:7f00:1]/", "http://app.localhost/"]
      .map(t => TypedAddressPolicy.judge(t, SETTINGS))).toEqual([
      { kind: "Allowed", origin: "http://localhost:3000" },
      { kind: "Refused", reason: "Local" },
      { kind: "Refused", reason: "Local" },
      { kind: "Refused", reason: "Local" },
      { kind: "Refused", reason: "Local" },
      { kind: "Refused", reason: "Local" },
      { kind: "Refused", reason: "Local" }
    ]);
  });

  it("judges the forms the URL parser rewrites, full-width, ideographic dots and international names, as the address they become", () => {
    expect(["http://ｌｏｃａｌｈｏｓｔ:3000/", "http://127。0。0。1/", "http://１９２．１６８．１．２/", "https://bücher.example/", "http://localhost..:3000/"]
      .map(t => TypedAddressPolicy.judge(t, SETTINGS))).toEqual([
      { kind: "Allowed", origin: "http://localhost:3000" },
      { kind: "Refused", reason: "Local" },
      { kind: "Refused", reason: "Local" },
      { kind: "Allowed", origin: "https://xn--bcher-kva.example" },
      { kind: "Refused", reason: "Local" }
    ]);
  });

  it("refuses the shared address space and unique local IPv6 addresses as private, and takes the addresses just outside them", () => {
    expect(["http://100.64.0.1/", "http://100.127.255.254/", "http://[fc00::1]/", "http://[fdff:ffff::1]/"].map(t => TypedAddressPolicy.judge(t, [])))
      .toEqual(new Array(4).fill({ kind: "Refused", reason: "Local" }));
    expect(["http://100.63.255.255/", "http://100.128.0.1/", "http://[fe00::1]/"].map(t => TypedAddressPolicy.judge(t, [])))
      .toEqual([{ kind: "Allowed", origin: "http://100.63.255.255" }, { kind: "Allowed", origin: "http://100.128.0.1" }, { kind: "Allowed", origin: "http://[fe00::1]" }]);
  });

  it("never allows a link-local or unspecified address, even when the app's settings name it", () => {
    const settings: readonly string[] = ["http://169.254.169.254", "http://0.0.0.0"];

    expect(["http://169.254.169.254/latest", "http://0.0.0.0/", "http://[fe80::1]/", "http://[::]/"].map(t => TypedAddressPolicy.judge(t, settings)))
      .toEqual(new Array(4).fill({ kind: "Refused", reason: "NeverAllowed" }));
  });
});

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { afterEach, describe, expect, it } from "vitest";

import { FixtureRequest, FixtureServers } from "../fixtures/fixture-servers.ts";

describe("FixtureServers", () => {
  const servers = new FixtureServers();

  afterEach(async () => {
    await servers.closeAsync();
  });

  it("serves a page added after the start, redirects a path, and answers anything else with 404", async () => {
    const server = await servers.startAsync("allowed.localhost", {});
    server.serve("/added", "<p>Added</p>");
    server.redirect("/go", "http://other.localhost/");
    const address = `http://127.0.0.1:${server.port}`;

    const added = await fetch(`${address}/added`);
    const redirected = await fetch(`${address}/go`, { redirect: "manual" });
    const missing = await fetch(`${address}/missing`);

    expect([added.status, await added.text(), redirected.status, redirected.headers.get("location"), missing.status])
      .toEqual([200, "<p>Added</p>", 302, "http://other.localhost/", 404]);
  });

  it("lists every server's requests, with the host each named", async () => {
    const first = await servers.startAsync("first.localhost", { "/": "<p>First</p>" });
    const second = await servers.startAsync("second.localhost", { "/": "<p>Second</p>" });

    await fetch(`http://127.0.0.1:${first.port}/`);
    await fetch(`http://127.0.0.1:${second.port}/missing`);

    expect(servers.requests).toEqual([new FixtureRequest(`127.0.0.1:${first.port}`, "/"), new FixtureRequest(`127.0.0.1:${second.port}`, "/missing")]);
  });
});

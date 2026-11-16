/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { request } from "node:http";

import { afterEach, describe, expect, it } from "vitest";

import { FixtureServers } from "../fixtures/fixture-servers.ts";
import { LoopbackGuard } from "../fixtures/loopback-guard.ts";
import { RecordingProxy } from "../fixtures/recording-proxy.ts";
import { ViewRequest } from "../fixtures/view-requests.ts";

class RecordedRequests {
  public readonly pending: ViewRequest[] = [];

  public async takeAsync(): Promise<readonly ViewRequest[]> {
    return this.pending.splice(0);
  }
}

describe("LoopbackGuard", () => {
  const servers = new FixtureServers();
  let proxy: RecordingProxy | null = null;

  afterEach(async () => {
    await servers.closeAsync();
    await proxy?.closeAsync();
    proxy = null;
  });

  async function startAsync(): Promise<{ guard: LoopbackGuard; requests: RecordedRequests; proxy: RecordingProxy; origin: string }> {
    const server = await servers.startAsync("allowed.localhost", { "/": "<p>Allowed</p>" });
    const started = await RecordingProxy.startAsync();
    proxy = started;
    const requests = new RecordedRequests();
    return { guard: new LoopbackGuard(servers, started, requests), requests, proxy: started, origin: server.origin };
  }

  async function sendThroughAsync(started: RecordingProxy): Promise<void> {
    const address = new URL(started.address);
    await new Promise<void>(resolve => {
      const sent = request({ host: address.hostname, port: address.port, path: "http://outside.example/pixel.png" });
      sent.once("error", () => resolve());
      sent.end();
    });
  }

  it("passes a fixture server's request, by its name or its address, a request the base refused and a request with no network", async () => {
    const { guard, requests, origin } = await startAsync();
    const port = new URL(origin).port;
    requests.pending.push(new ViewRequest(`${origin}/`, null), new ViewRequest(`http://127.0.0.1:${port}/`, "net::ERR_ABORTED"),
      new ViewRequest("http://outside.example/", "net::ERR_BLOCKED_BY_CLIENT"), new ViewRequest("data:text/plain,inline", null),
      new ViewRequest("not a url", null));

    expect(await guard.takeViolationsAsync()).toEqual([]);
  });

  it("reports a request to another host that completed or failed after it left the app", async () => {
    const { guard, requests } = await startAsync();
    requests.pending.push(new ViewRequest("https://outside.example/", null), new ViewRequest("ws://127.0.0.1:1/", "net::ERR_CONNECTION_REFUSED"));

    expect(await guard.takeViolationsAsync()).toEqual([
      "A view's request to https://outside.example/ completed.",
      "A view's request to ws://127.0.0.1:1/ ended with net::ERR_CONNECTION_REFUSED."
    ]);
  });

  it("reports each request the recording proxy received, once", async () => {
    const { guard, proxy: started } = await startAsync();
    await sendThroughAsync(started);

    expect(await guard.takeViolationsAsync()).toEqual(["The recording proxy received GET http://outside.example/pixel.png."]);
    expect(await guard.takeViolationsAsync()).toEqual([]);
  });

  it("lets a peek at the recording proxy leave its records for the guard", async () => {
    const { guard, proxy: started } = await startAsync();
    await sendThroughAsync(started);

    expect(started.peek()).toEqual(["GET http://outside.example/pixel.png"]);
    expect(await guard.takeViolationsAsync()).toEqual(["The recording proxy received GET http://outside.example/pixel.png."]);
  });
});

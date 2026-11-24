/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { once } from "node:events";
import { createServer, type IncomingMessage, request, type Server } from "node:http";

import { afterEach, describe, expect, it } from "vitest";

import { RecordingProxy } from "../fixtures/recording-proxy.ts";

describe("RecordingProxy", () => {
  let proxy: RecordingProxy | null = null;
  let server: Server | null = null;

  afterEach(async () => {
    await proxy?.closeAsync();
    proxy = null;
    if (!Object.isNull(server)) {
      const closed = once(server, "close");
      server.closeAllConnections();
      server.close();
      await closed;
    }
    server = null;
  });

  // A fixture server that sends its headers and part of its body, then closes the connection, as a closing fixture server does to an answer still in flight.
  async function startBreakingAsync(): Promise<number> {
    const started = createServer((_, response) => {
      response.writeHead(200, { "content-type": "text/plain" });
      response.write("part", () => response.socket?.destroy());
    });
    server = started;
    started.listen(0, "127.0.0.1");
    await once(started, "listening");
    const address = started.address();
    if (Object.isNull(address) || typeof address === "string")
      throw new Error("The breaking server isn't listening on a port.");
    return address.port;
  }

  async function sendThroughAsync(started: RecordingProxy, url: string): Promise<IncomingMessage> {
    const address = new URL(started.address);
    return new Promise<IncomingMessage>((resolve, reject) => {
      const sent = request({ host: address.hostname, port: address.port, path: url }, resolve);
      sent.on("error", reject);
      sent.end();
    });
  }

  it("ends the answer it passes on when the fixture server breaks it off", async () => {
    const port = await startBreakingAsync();
    proxy = await RecordingProxy.startAsync();

    const answer = await sendThroughAsync(proxy, `http://broken.test:${String(port)}/`);
    // The client's own answer fails as aborted, which `once` would throw, so the test waits on its close alone.
    const closed = new Promise<void>(resolve => answer.on("close", resolve));
    answer.on("error", () => answer.destroy());
    answer.resume();
    await closed;

    expect(answer.statusCode, "The proxy didn't pass on the fixture server's status.").toBe(200);
    expect(answer.complete, "The proxy ended the broken answer as if it were whole.").toBe(false);
    expect(proxy.peek(), "The proxy recorded a request for a fixture server's .test name.").toEqual([]);
  });
});

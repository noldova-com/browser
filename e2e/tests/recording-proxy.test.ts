/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { once } from "node:events";
import { createServer, type IncomingMessage, request, type Server, type ServerResponse } from "node:http";

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

  // A fixture server that sends its headers, then answers each request as `answer` does.
  async function startFixtureAsync(answer: (request: IncomingMessage, response: ServerResponse) => void): Promise<number> {
    const started = createServer((sent, response) => {
      response.writeHead(200, { "content-type": "text/plain" });
      answer(sent, response);
    });
    server = started;
    started.listen(0, "127.0.0.1");
    await once(started, "listening");
    const address = started.address();
    if (Object.isNull(address) || Object.isString(address))
      throw new Error("The fixture server isn't listening on a port.");
    return address.port;
  }

  function sendThrough(started: RecordingProxy, url: string): Promise<IncomingMessage> {
    const address = new URL(started.address);
    return new Promise<IncomingMessage>((resolve, reject) => {
      const sent = request({ host: address.hostname, port: address.port, path: url }, resolve);
      sent.on("error", reject);
      sent.end();
    });
  }

  it("ends the answer it passes on when the fixture server breaks it off", async () => {
    // The server sends part of its body, then closes the connection, as a closing fixture server does to an answer still in flight.
    const port = await startFixtureAsync((_, response) => response.write("part", () => response.socket?.destroy()));
    proxy = await RecordingProxy.startAsync();

    const answer = await sendThrough(proxy, `http://broken.test:${String(port)}/`);
    // The client's own answer fails as aborted, which `once` would throw, so the test waits on its close alone.
    const closed = new Promise<void>(resolve => answer.on("close", resolve));
    answer.on("error", () => answer.destroy());
    answer.resume();
    await closed;

    expect(answer.statusCode, "The proxy didn't pass on the fixture server's status.").toBe(200);
    expect(answer.complete, "The proxy ended the broken answer as if it were whole.").toBe(false);
    expect(proxy.peek(), "The proxy recorded a request for a fixture server's .test name.").toEqual([]);
  });

  it("ends its request to the fixture server when the client gives up on a held answer", async () => {
    // The server sends the start of its body, which carries its headers through the proxy, and holds the rest, as a held path does, so only the client
    // giving up can end the exchange before the server closes.
    // The server's unfinished response closes only when its connection does, so its close shows the proxy ended its request.
    const reached = Promise.withResolvers<ServerResponse>();
    const port = await startFixtureAsync((_, response) => {
      response.write("start", () => reached.resolve(response));
    });
    proxy = await RecordingProxy.startAsync();

    const answer = await sendThrough(proxy, `http://held.test:${String(port)}/`);
    const held = await reached.promise;
    const left = once(held, "close");
    answer.on("error", () => undefined);
    answer.destroy();
    await left;

    expect(answer.statusCode, "The proxy didn't pass on the held answer's headers.").toBe(200);
    expect(proxy.peek(), "The proxy recorded a request for a fixture server's .test name.").toEqual([]);
  });
});

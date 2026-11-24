/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { once } from "node:events";
import { createServer, request as forward, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { type AddressInfo, connect, type Socket } from "node:net";
import type { Duplex } from "node:stream";

// Records every request it gets and answers none, except a request for a fixture server's `.test` name, which stands for a public origin:
// that one it passes to the fixture server on loopback, as a proxy passes a request to a public site, so the base judges the name, not the
// proxy's loopback address.
export class RecordingProxy {
  private static readonly LOOPBACK: string = "127.0.0.1";
  private static readonly FIXTURE_SUFFIX: string = ".test";
  private static readonly ESTABLISHED: string = "HTTP/1.1 200 Connection Established\r\n\r\n";

  private readonly server: Server;
  private readonly recorded: string[] = [];
  private readonly tunnels: Set<Socket> = new Set();

  private constructor() {
    this.server = createServer((request, response) => {
      const target = URL.parse(request.url ?? "");
      if (!Object.isNull(target) && RecordingProxy.isFixture(target.hostname))
        RecordingProxy.pass(request, response, target);
      else {
        this.recorded.push(`${request.method ?? ""} ${request.url ?? ""}`);
        request.socket.destroy();
      }
    });
    this.server.on("connect", (request, socket) => {
      const target = URL.parse(`http://${request.url ?? ""}`);
      if (!Object.isNull(target) && RecordingProxy.isFixture(target.hostname))
        this.tunnel(socket, Number(target.port));
      else {
        this.recorded.push(`CONNECT ${request.url ?? ""}`);
        socket.destroy();
      }
    });
    this.server.on("upgrade", (request, socket) => {
      this.recorded.push(`UPGRADE ${request.url ?? ""}`);
      socket.destroy();
    });
  }

  public static async startAsync(): Promise<RecordingProxy> {
    const proxy = new RecordingProxy();
    proxy.server.listen(0, RecordingProxy.LOOPBACK);
    await once(proxy.server, "listening");
    return proxy;
  }

  public get address(): string {
    const address: AddressInfo | string | null = this.server.address();
    if (address === null || typeof address === "string")
      throw new Error("The recording proxy isn't listening on a port.");
    return `http://${RecordingProxy.LOOPBACK}:${address.port}`;
  }

  public peek(): readonly string[] {
    return [...this.recorded];
  }

  public take(): readonly string[] {
    return this.recorded.splice(0);
  }

  public async closeAsync(): Promise<void> {
    const closed = once(this.server, "close");
    for (const tunnel of this.tunnels)
      tunnel.destroy();
    this.server.closeAllConnections();
    this.server.close();
    await closed;
  }

  private static isFixture(hostname: string): boolean {
    return hostname.endsWith(RecordingProxy.FIXTURE_SUFFIX);
  }

  private static pass(request: IncomingMessage, response: ServerResponse, target: URL): void {
    const passed = forward({ host: RecordingProxy.LOOPBACK, port: Number(target.port), path: `${target.pathname}${target.search}`, method: request.method, headers: request.headers },
      answer => {
        response.writeHead(answer.statusCode ?? 502, answer.headers);
        answer.on("error", () => response.destroy());
        answer.pipe(response);
      });
    passed.on("error", () => request.socket.destroy());
    response.on("close", () => passed.destroy());
    request.pipe(passed);
  }

  private tunnel(client: Duplex, port: number): void {
    const server = connect(port, RecordingProxy.LOOPBACK, () => {
      client.write(RecordingProxy.ESTABLISHED);
      server.pipe(client);
      client.pipe(server);
    });
    this.tunnels.add(server);
    server.on("close", () => {
      this.tunnels.delete(server);
      client.destroy();
    });
    server.on("error", () => client.destroy());
    client.on("error", () => server.destroy());
    client.on("close", () => server.destroy());
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { once } from "node:events";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

export class RecordingProxy {
  private static readonly LOOPBACK: string = "127.0.0.1";

  private readonly server: Server;
  private readonly recorded: string[] = [];

  private constructor() {
    this.server = createServer((request) => {
      this.recorded.push(`${request.method ?? ""} ${request.url ?? ""}`);
      request.socket.destroy();
    });
    this.server.on("connect", (request, socket) => {
      this.recorded.push(`CONNECT ${request.url ?? ""}`);
      socket.destroy();
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
    this.server.closeAllConnections();
    this.server.close();
    await closed;
  }
}

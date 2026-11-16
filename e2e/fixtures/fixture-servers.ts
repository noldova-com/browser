/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { once } from "node:events";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

export class FixtureRequest {
  public readonly host: string;
  public readonly path: string;

  public constructor(host: string, path: string) {
    this.host = host;
    this.path = path;
  }
}

export class FixtureServer {
  private static readonly LOOPBACK: string = "127.0.0.1";
  private static readonly HTML: string = "text/html; charset=utf-8";

  public readonly name: string;
  public readonly address: string;
  private readonly server: Server;
  private readonly pages: Map<string, string>;
  private readonly redirects: Map<string, string> = new Map();
  private readonly received: FixtureRequest[] = [];

  private constructor(name: string, address: string, pages: Readonly<Record<string, string>>) {
    this.name = name;
    this.address = address;
    this.pages = new Map(Object.entries(pages));
    this.server = createServer((request, response) => this.answer(request, response));
  }

  public static async startAsync(name: string, pages: Readonly<Record<string, string>>, address: string = FixtureServer.LOOPBACK): Promise<FixtureServer> {
    const server = new FixtureServer(name, address, pages);
    server.server.listen(0, address);
    await once(server.server, "listening");
    return server;
  }

  public get port(): number {
    const address: AddressInfo | string | null = this.server.address();
    if (address === null || typeof address === "string")
      throw new Error(`The fixture server for ${this.name} isn't listening on a port.`);
    return address.port;
  }

  public get origin(): string {
    return `http://${this.name}:${this.port}`;
  }

  public get hosts(): readonly string[] {
    return [`${this.name}:${this.port}`, `${this.address}:${this.port}`];
  }

  public get requests(): readonly FixtureRequest[] {
    return [...this.received];
  }

  public serve(path: string, page: string): void {
    this.pages.set(path, page);
  }

  public redirect(path: string, location: string): void {
    this.redirects.set(path, new URL(location).href);
  }

  public url(path: string): string {
    return `${this.origin}${path}`;
  }

  public async closeAsync(): Promise<void> {
    const closed = once(this.server, "close");
    this.server.closeAllConnections();
    this.server.close();
    await closed;
  }

  private answer(request: IncomingMessage, response: ServerResponse): void {
    const path = request.url ?? "";
    this.received.push(new FixtureRequest(request.headers.host ?? "", path));
    const location = this.redirects.get(path);
    if (location !== undefined) {
      response.writeHead(302, { location, "cache-control": "no-store" }).end();
      return;
    }
    const page = this.pages.get(path);
    if (page === undefined) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { "content-type": FixtureServer.HTML, "cache-control": "no-store" }).end(page);
  }
}

export class FixtureServers {
  private readonly started: FixtureServer[] = [];

  public get hosts(): ReadonlySet<string> {
    return new Set(this.started.flatMap(t => t.hosts));
  }

  public get requests(): readonly FixtureRequest[] {
    return this.started.flatMap(t => t.requests);
  }

  public async startAsync(name: string, pages: Readonly<Record<string, string>>, address?: string): Promise<FixtureServer> {
    const server = await FixtureServer.startAsync(name, pages, address);
    this.started.push(server);
    return server;
  }

  public async closeAsync(): Promise<void> {
    await Promise.all(this.started.splice(0).map(t => t.closeAsync()));
  }
}

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

class FixturePage {
  public readonly body: string;
  public readonly headers: Readonly<Record<string, string>>;

  public constructor(body: string, headers: Readonly<Record<string, string>>) {
    this.body = body;
    this.headers = headers;
  }
}

export class FixtureServer {
  private static readonly LOOPBACK: string = "127.0.0.1";
  private static readonly HTML: string = "text/html; charset=utf-8";

  public readonly name: string;
  private readonly server: Server;
  private readonly pages: Map<string, FixturePage>;
  private readonly redirects: Map<string, string> = new Map();
  private readonly received: FixtureRequest[] = [];

  private constructor(name: string, pages: Readonly<Record<string, string>>) {
    this.name = name;
    this.pages = new Map(Object.entries(pages).map(([path, body]) => [path, new FixturePage(body, {})]));
    this.server = createServer((request, response) => this.answer(request, response));
    this.server.on("upgrade", (request, socket) => {
      this.received.push(new FixtureRequest(request.headers.host ?? "", request.url ?? ""));
      socket.destroy();
    });
  }

  public static async startAsync(name: string, pages: Readonly<Record<string, string>>): Promise<FixtureServer> {
    const server = new FixtureServer(name, pages);
    server.server.listen(0, FixtureServer.LOOPBACK);
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
    return [`${this.name}:${this.port}`, `${FixtureServer.LOOPBACK}:${this.port}`];
  }

  public get requests(): readonly FixtureRequest[] {
    return [...this.received];
  }

  public serve(path: string, body: string, headers: Readonly<Record<string, string>> = {}): void {
    this.pages.set(path, new FixturePage(body, headers));
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
    response.writeHead(200, { "content-type": FixtureServer.HTML, "cache-control": "no-store", ...page.headers }).end(page.body);
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

  public async startAsync(name: string, pages: Readonly<Record<string, string>>): Promise<FixtureServer> {
    const server = await FixtureServer.startAsync(name, pages);
    this.started.push(server);
    return server;
  }

  public async closeAsync(): Promise<void> {
    await Promise.all(this.started.splice(0).map(t => t.closeAsync()));
  }
}

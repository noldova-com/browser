/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { once } from "node:events";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { createServer as createSecureServer } from "node:https";
import type { AddressInfo } from "node:net";

import type { TestCertificate } from "./test-certificate.ts";

export class FixtureRequest {
  public readonly host: string;
  public readonly path: string;

  public constructor(host: string, path: string) {
    this.host = host;
    this.path = path;
  }
}

class FixtureLogLine {
  public readonly order: number;
  public readonly text: string;

  public constructor(order: number, text: string) {
    this.order = order;
    this.text = text;
  }
}

class FixturePage {
  public readonly body: string;
  public readonly headers: Readonly<Record<string, string>>;
  public readonly status: number;

  public constructor(body: string, headers: Readonly<Record<string, string>>, status: number) {
    this.body = body;
    this.headers = headers;
    this.status = status;
  }
}

export class FixtureServer {
  private static readonly LOOPBACK: string = "127.0.0.1";
  private static readonly FETCH_HEADERS: readonly string[] = ["sec-fetch-site", "sec-fetch-mode", "sec-fetch-dest", "sec-purpose", "purpose"];
  // Shared by every server, so lines from several servers merge in the order their requests arrived, even within one millisecond.
  private static logged: number = 0;
  private static readonly HTML: string = "text/html; charset=utf-8";
  private static readonly OK: number = 200;
  private static readonly FAVICON: string = "/favicon.ico";

  public readonly name: string;
  public readonly address: string;
  private readonly scheme: string;
  private readonly server: Server;
  private readonly pages: Map<string, FixturePage>;
  private readonly redirects: Map<string, string> = new Map();
  private readonly holds: Map<string, Promise<void>> = new Map();
  private listened: number | null = null;
  private readonly received: FixtureRequest[] = [];
  private readonly logLines: FixtureLogLine[] = [];

  private constructor(name: string, address: string, pages: Readonly<Record<string, string>>, certificate: TestCertificate | null) {
    this.name = name;
    this.address = address;
    this.pages = new Map(Object.entries(pages).map(([path, body]) => [path, new FixturePage(body, {}, FixtureServer.OK)]));
    const listener = (request: IncomingMessage, response: ServerResponse): void => this.answer(request, response);
    this.scheme = certificate === null ? "http" : "https";
    this.server = certificate === null ? createServer(listener) : createSecureServer({ key: certificate.key, cert: certificate.certificate }, listener);
    this.server.on("upgrade", (request, socket) => {
      this.note(request, request.url ?? "");
      socket.destroy();
    });
  }

  public static async startAsync(name: string, pages: Readonly<Record<string, string>>, address: string = FixtureServer.LOOPBACK,
    certificate: TestCertificate | null = null): Promise<FixtureServer> {
    const server = new FixtureServer(name, address, pages, certificate);
    server.server.listen(0, address);
    await once(server.server, "listening");
    server.listened = server.port;
    return server;
  }

  // The port the server listened on, which it keeps once closed, so the loopback guard still knows a server a test closed.
  public get port(): number {
    if (this.listened !== null)
      return this.listened;
    const address: AddressInfo | string | null = this.server.address();
    if (address === null || typeof address === "string")
      throw new Error(`The fixture server for ${this.name} isn't listening on a port.`);
    return address.port;
  }

  public get origin(): string {
    return `${this.scheme}://${this.name}:${this.port}`;
  }

  public get hosts(): readonly string[] {
    return [`${this.name}:${this.port}`, `${this.address}:${this.port}`];
  }

  public get requests(): readonly FixtureRequest[] {
    return [...this.received];
  }

  // The paths of the requests it received without the favicon, which a view asks for after a page, at times of its own.
  public get pagePaths(): readonly string[] {
    return this.received.map(t => t.path).filter(t => t !== FixtureServer.FAVICON);
  }

  // Each request with its time, the client's port and the headers that say what kind of request it is, for a failed test's attachment.
  public get log(): readonly FixtureLogLine[] {
    return [...this.logLines];
  }

  public serve(path: string, body: string, headers: Readonly<Record<string, string>> = {}, status: number = FixtureServer.OK): void {
    this.pages.set(path, new FixturePage(body, headers, status));
  }

  // Holds the answer to each request for the path until the function it returns runs, so a view stays loading the path until then.
  public hold(path: string): () => void {
    const released = Promise.withResolvers<void>();
    this.holds.set(path, released.promise);
    return (): void => {
      this.holds.delete(path);
      released.resolve();
    };
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

  private note(request: IncomingMessage, path: string): void {
    this.received.push(new FixtureRequest(request.headers.host ?? "", path));
    const kinds = FixtureServer.FETCH_HEADERS.filter(t => request.headers[t] !== undefined).map(t => `${t}=${String(request.headers[t])}`);
    FixtureServer.logged += 1;
    this.logLines.push(new FixtureLogLine(FixtureServer.logged, [new Date().toISOString(), `${this.name}:${this.port}`, path, `from port ${String(request.socket.remotePort)}`, ...kinds].join(" ")));
  }

  private answer(request: IncomingMessage, response: ServerResponse): void {
    const path = request.url ?? "";
    this.note(request, path);
    const held = this.holds.get(path);
    if (held === undefined)
      this.send(path, response);
    else
      void held.then(() => this.send(path, response));
  }

  private send(path: string, response: ServerResponse): void {
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
    response.writeHead(page.status, { "content-type": FixtureServer.HTML, "cache-control": "no-store", ...page.headers }).end(page.body);
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

  // Every server's log in the order the requests arrived.
  public get log(): readonly string[] {
    return this.started.flatMap(t => t.log).sort((a, b) => a.order - b.order).map(t => t.text);
  }

  public async startAsync(name: string, pages: Readonly<Record<string, string>>, address?: string, certificate?: TestCertificate): Promise<FixtureServer> {
    const server = await FixtureServer.startAsync(name, pages, address, certificate);
    this.started.push(server);
    return server;
  }

  public async closeAsync(): Promise<void> {
    await Promise.all(this.started.splice(0).map(t => t.closeAsync()));
  }
}

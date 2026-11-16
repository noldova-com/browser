/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { FixtureServers } from "./fixture-servers.ts";
import type { RecordingProxy } from "./recording-proxy.ts";
import type { ViewRequest, ViewRequests } from "./view-requests.ts";

export class LoopbackGuard {
  private static readonly REFUSED: string = "net::ERR_BLOCKED_BY_CLIENT";
  private static readonly NETWORK_SCHEMES: ReadonlySet<string> = new Set(["http:", "https:", "ws:", "wss:"]);

  private readonly servers: FixtureServers;
  private readonly proxy: RecordingProxy;
  private readonly requests: Pick<ViewRequests, "takeAsync">;

  public constructor(servers: FixtureServers, proxy: RecordingProxy, requests: Pick<ViewRequests, "takeAsync">) {
    this.servers = servers;
    this.proxy = proxy;
    this.requests = requests;
  }

  public async takeViolationsAsync(): Promise<readonly string[]> {
    const hosts = this.servers.hosts;
    const sent = (await this.requests.takeAsync()).filter(t => LoopbackGuard.leaves(t, hosts));
    return [
      ...this.proxy.take().map(t => `The recording proxy received ${t}.`),
      ...sent.map(t => `A view's request to ${t.url} ${t.error === null ? "completed" : `ended with ${t.error}`}.`)
    ];
  }

  private static leaves(request: ViewRequest, hosts: ReadonlySet<string>): boolean {
    const url = URL.parse(request.url);
    return url !== null && LoopbackGuard.NETWORK_SCHEMES.has(url.protocol) && !hosts.has(url.host) && request.error !== LoopbackGuard.REFUSED;
  }
}

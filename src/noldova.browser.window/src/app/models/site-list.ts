/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../../resources.ts";

export class SiteList {
  public readonly hosts: readonly string[];
  public readonly ignored: readonly number[];
  public readonly ignoredEntries: readonly string[];

  private constructor(hosts: readonly string[], ignored: readonly number[], ignoredEntries: readonly string[]) {
    this.hosts = hosts;
    this.ignored = ignored;
    this.ignoredEntries = ignoredEntries;
  }

  public static read(text: string): SiteList {
    const hosts: string[] = [];
    const ignored: number[] = [];
    const ignoredEntries: string[] = [];
    const entries: readonly string[] = text.split(Resources.siteSeparator).map(t => t.trim()).filter(t => t !== "");
    for (const [index, entry] of entries.entries()) {
      const host: string | null = SiteList.hostOf(entry);
      if (host === null) {
        ignored.push(index + 1);
        ignoredEntries.push(entry);
      } else if (!hosts.includes(host))
        hosts.push(host);
    }
    return new SiteList(hosts, ignored, ignoredEntries);
  }

  public matches(url: string): boolean {
    const parsed: URL | null = URL.parse(url);
    if (parsed === null)
      return false;
    const host: string = parsed.hostname.replace(Resources.trailingDotPattern, "");
    return this.hosts.some(t => host === t || host.endsWith(Resources.formatSubdomainSuffix(t)));
  }

  private static hostOf(entry: string): string | null {
    const unstarred: string = entry.replace(Resources.wildcardPattern, Resources.wildcardReplacement);
    const address: URL | null = URL.parse(unstarred.includes(Resources.schemeSeparator) ? unstarred : Resources.formatDefaultSchemeAddress(unstarred));
    const text: string = address === null ? "" : address.hostname;
    if (!Resources.hostTextPattern.test(text))
      return null;
    const parsed: URL | null = URL.parse(Resources.formatHostAddress(text));
    if (parsed === null)
      return null;
    const host: string = parsed.hostname.replace(Resources.trailingDotPattern, "");
    return host === "" || host.startsWith(Resources.hostLabelSeparator) || host.includes(Resources.emptyLabel) ? null : host;
  }
}

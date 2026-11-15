/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { AddressKind } from "../enums/address-kind.ts";
import { Resources } from "../resources.ts";
import { AddressKinds } from "./address-kinds.ts";

export class LocalSites {
  private static readonly LOCAL_KINDS: readonly AddressKind[] = [AddressKind.Loopback, AddressKind.Private];

  public readonly origins: readonly string[];
  public readonly ignored: readonly number[];
  public readonly ignoredEntries: readonly string[];

  private constructor(origins: readonly string[], ignored: readonly number[], ignoredEntries: readonly string[]) {
    this.origins = origins;
    this.ignored = ignored;
    this.ignoredEntries = ignoredEntries;
  }

  public static read(text: string): LocalSites {
    const origins: string[] = [];
    const ignored: number[] = [];
    const ignoredEntries: string[] = [];
    const entries: readonly string[] = text.split(Resources.localSitesSeparator).map(t => t.trim()).filter(t => t !== "");
    for (const [index, entry] of entries.entries()) {
      const origin: string | null = LocalSites.originOf(entry);
      if (origin === null) {
        ignored.push(index + 1);
        ignoredEntries.push(entry);
      } else if (!origins.includes(origin))
        origins.push(origin);
    }
    return new LocalSites(origins, ignored, ignoredEntries);
  }

  private static originOf(entry: string): string | null {
    const parsed: URL | null = URL.parse(entry);
    if (parsed === null || !Resources.webSchemes.includes(parsed.protocol) || parsed.username !== "" || parsed.password !== ""
      || parsed.href !== Resources.formatOriginRoot(parsed.origin))
      return null;
    if (Resources.wildcardPattern.test(entry + parsed.hostname) || Resources.emptyLabelPattern.test(parsed.hostname))
      return null;
    return LocalSites.LOCAL_KINDS.includes(AddressKinds.ofHost(parsed.hostname)) ? parsed.origin : null;
  }
}

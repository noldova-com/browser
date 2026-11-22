/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader, type JsonObject } from "@noldova/context.json";

export class LockfileParts {
  private static readonly PACKAGES: string = "packages";
  private static readonly ROOT: string = "";
  private static readonly FOLDER: string = "node_modules/";
  private static readonly VERSION: string = "version";
  private static readonly NEEDED_FIELDS: readonly string[] = ["dependencies", "optionalDependencies", "peerDependencies"];
  private static readonly PEERS: string = "peerDependencies";
  private static readonly PEERS_META: string = "peerDependenciesMeta";
  private static readonly OPTIONAL: string = "optional";
  private static readonly DECLARED_FIELDS: readonly string[] = ["license", "dependencies", "optionalDependencies", "peerDependencies", "peerDependenciesMeta", "bin", "engines", "os", "cpu",
    "funding"];

  public static entry(manifest: JsonReader, resolved: string): JsonObject {
    const declared = LockfileParts.DECLARED_FIELDS.filter(t => manifest.hasField(t)).map(t => [t, manifest.readValue(t)]);
    return { version: manifest.readString(LockfileParts.VERSION), resolved, ...Object.fromEntries(declared) };
  }

  public static findUnlisted(parts: ReadonlyMap<string, JsonReader>, listed: JsonObject): readonly string[] {
    const needed = [...parts.values()].flatMap(t => LockfileParts.readNeeded(t));
    return [...new Set(needed)].filter(t => !parts.has(t) && !Object.hasOwn(listed, t)).sort();
  }

  public static withParts(lock: JsonReader, entries: ReadonlyMap<string, JsonObject>, dependencies: JsonObject): JsonObject {
    const added = [...entries].map(([name, entry]) => [`${LockfileParts.FOLDER}${name}`, entry]);
    return LockfileParts.replaceParts(lock, [...entries.keys()], Object.fromEntries(added), dependencies);
  }

  public static withoutParts(lock: JsonReader, names: readonly string[], dependencies: JsonObject): JsonObject {
    return LockfileParts.replaceParts(lock, names, {}, dependencies);
  }

  private static readNeeded(manifest: JsonReader): readonly string[] {
    const meta = manifest.hasField(LockfileParts.PEERS_META) ? manifest.readObject(LockfileParts.PEERS_META) : JsonReader.parse("{}");
    const isOptionalPeer = (field: string, name: string): boolean => field === LockfileParts.PEERS && meta.hasField(name) && meta.readObject(name).hasField(LockfileParts.OPTIONAL) &&
      meta.readObject(name).readBoolean(LockfileParts.OPTIONAL);
    return LockfileParts.NEEDED_FIELDS.filter(t => manifest.hasField(t))
      .flatMap(field => Object.keys(manifest.readObject(field).toJson()).filter(name => !isOptionalPeer(field, name)));
  }

  private static replaceParts(lock: JsonReader, names: readonly string[], added: JsonObject, dependencies: JsonObject): JsonObject {
    const packages = lock.readObject(LockfileParts.PACKAGES);
    const root = { ...packages.readObject(LockfileParts.ROOT).toJson(), dependencies };
    const folders = names.map(t => `${LockfileParts.FOLDER}${t}`);
    const kept = Object.entries(packages.toJson()).filter(([key]) => key !== LockfileParts.ROOT && !folders.some(t => key === t || key.startsWith(`${t}/`)));
    return { ...lock.toJson(), [LockfileParts.PACKAGES]: { [LockfileParts.ROOT]: root, ...Object.fromEntries(kept), ...added } };
  }
}

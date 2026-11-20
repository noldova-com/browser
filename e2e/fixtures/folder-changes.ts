/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class FolderChanges {
  // The names a folder gained, each after "+ ", then the ones it lost, each after "- ", so a failed check names what stayed or went.
  public static between(before: readonly string[], after: readonly string[]): readonly string[] {
    return [...after.filter(t => !before.includes(t)).map(t => `+ ${t}`), ...before.filter(t => !after.includes(t)).map(t => `- ${t}`)];
  }
}

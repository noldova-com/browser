/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

// A file a package's export points to, with the subpath it exports it as.
export class ExportTarget {
  public readonly subpath: string;
  public readonly target: string;

  public constructor(subpath: string, target: string) {
    this.subpath = subpath;
    this.target = target;
  }
}

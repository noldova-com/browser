/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { PackageException } from "./package.exception.ts";

export class OwnPinDiffersException extends PackageException {
  public readonly file: string;
  public readonly packageName: string;
  public readonly pin: string;
  public readonly version: string;

  public constructor(file: string, packageName: string, pin: string, version: string) {
    super(Resources.formatOwnPinDiffers(file, packageName, pin, version));

    this.file = file;
    this.packageName = packageName;
    this.pin = pin;
    this.version = version;
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Buffer } from "node:buffer";

import { CutText } from "../models/cut-text.ts";
import { Resources } from "../resources.ts";

export class OutputLimits {
  private static readonly CONTINUATION_MASK: number = 0b1100_0000;
  private static readonly CONTINUATION_BITS: number = 0b1000_0000;

  public static byteLength(text: string): number {
    return Buffer.byteLength(text, Resources.textEncoding);
  }

  public static cutText(text: string, maximumBytes: number): CutText {
    const bytes: Buffer = Buffer.from(text, Resources.textEncoding);
    if (bytes.length <= maximumBytes)
      return new CutText(text, false);

    let end: number = maximumBytes;
    while (end > 0 && (bytes.readUInt8(end) & OutputLimits.CONTINUATION_MASK) === OutputLimits.CONTINUATION_BITS)
      end -= 1;
    return new CutText(bytes.subarray(0, end).toString(Resources.textEncoding), true);
  }

  public static decodedLength(base64: string): number {
    return Buffer.byteLength(base64, Resources.base64Encoding);
  }
}

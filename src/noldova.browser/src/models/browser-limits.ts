/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class BrowserLimits {
  public static readonly maximumUrlLength: number = 32_768;
  public static readonly maximumTypedTextLength: number = 10_000;
  public static readonly maximumReferenceLength: number = 64;
  public static readonly maximumWaitMilliseconds: number = 30_000;
  public static readonly maximumSnapshotBytes: number = 128 * 1024;
  public static readonly maximumTreeReplyBytes: number = 4 * 1024 * 1024;
  public static readonly maximumWholeTreeElements: number = 20_000;
  public static readonly maximumNodeReplyBytes: number = 64 * 1024;
  public static readonly consoleRingEntries: number = 500;
  public static readonly consoleRingBytes: number = 256 * 1024;
  public static readonly maximumConsoleEntryBytes: number = 2 * 1024;
  public static readonly maximumScreenshotSide: number = 1_600;
  public static readonly maximumScreenshotBytes: number = 1024 * 1024;
  public static readonly screenshotDrawMilliseconds: number = 1_000;
  public static readonly hiddenPageWidth: number = 1280;
  public static readonly hiddenPageHeight: number = 800;
  public static readonly maximumShownUrlLength: number = 2_048;
  public static readonly maximumShownTextLength: number = 1_024;
}

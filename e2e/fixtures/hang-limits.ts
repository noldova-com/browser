/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class HangLimits {
  public static readonly CI_TEST_COVERS_A_COLD_APP_START_AND_QUIT_MS: number = 120_000;
  public static readonly APP_QUITS_WITHIN_S: number = 30;
  public static readonly APP_CLOSES_AFTER_ITS_QUIT_MS: number = 30_000;
  // A tool's longest deadline, `Resources.maximumDeadlineMilliseconds`, 60 s, which every tool's wait and its answer fit within, and 5 s more for
  // the answer to come back through the agent double and the window, so a request the app answers in its own time always fits, and one it
  // never answers fails well within the test's timeout.
  public static readonly APP_ANSWERS_A_REQUEST_WITHIN_MS: number = 65_000;
}

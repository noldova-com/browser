/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class LaunchSetting {
  public readonly arguments: readonly string[];
  public readonly reason: string;

  public constructor(launchArguments: readonly string[], reason: string) {
    this.arguments = launchArguments;
    this.reason = reason;
  }
}

export class LaunchSettings {
  public static readonly HOST_RESOLVER_RULES: string = "MAP *.test 127.0.0.1, EXCLUDE localhost, EXCLUDE *.localhost, MAP * ~NOTFOUND";

  public static forRun(proxy: string): readonly LaunchSetting[] {
    return [
      new LaunchSetting(["--disable-gpu"], "GPU acceleration off, as in the base's workflows, so a run draws the same on a runner with no GPU."),
      new LaunchSetting(["--disable-software-rasterizer"], "No software stand-in for the GPU, as in the base's workflows."),
      new LaunchSetting(["--force-color-profile=srgb"], "One color profile on every runner, as in the base's workflows."),
      new LaunchSetting([`--host-resolver-rules=${LaunchSettings.HOST_RESOLVER_RULES}`],
        "Maps the fixture servers' .test names to 127.0.0.1 and fails every other lookup; localhost and .localhost names keep the engine's own loopback."),
      new LaunchSetting([`--proxy-server=${proxy}`],
        "Sends every request for an address that isn't loopback to the recording proxy, which records it and answers none, so a request the base fails to refuse never leaves the machine."),
      new LaunchSetting(["--proxy-bypass-list=*.test"], "Lets the .test names reach their fixture servers on 127.0.0.1, as loopback addresses do."),
      ...process.platform === "darwin" ? [new LaunchSetting(["-ApplePersistenceIgnoreState", "YES"], "No restored windows from an earlier run on macOS.")] : []
    ];
  }
}

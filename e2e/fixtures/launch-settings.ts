/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

export class LaunchSetting {
  public readonly arguments: readonly string[];
  public readonly reason: string;

  public constructor(launchArguments: readonly string[], reason: string) {
    this.arguments = launchArguments;
    this.reason = reason;
  }
}

export class LaunchSettings {
  // The one setting that no argument makes: the test sets it in the main process right after each launch.
  public static readonly DOWNLOADS_FOLDER_REASON: string = "A downloads folder of the app's own, beside its data and device folders, so a check that "
    + "a refused download writes nothing reads a new folder and never the account's own Downloads, which macOS lets a process read only once the person grants it.";
  public static readonly HOST_RESOLVER_RULES: string = "MAP loopback.example 127.0.0.1, EXCLUDE localhost, EXCLUDE *.localhost, EXCLUDE 127.0.0.1, MAP * ~NOTFOUND";

  public static forRun(proxy: string, deviceScale: number | null = null): readonly LaunchSetting[] {
    return [
      new LaunchSetting(["--disable-gpu"], "GPU acceleration off, as in the base's workflows, so a run draws the same on a runner with no GPU."),
      new LaunchSetting(["--disable-software-rasterizer"], "No software stand-in for the GPU, as in the base's workflows."),
      new LaunchSetting(["--force-color-profile=srgb"], "One color profile on every runner, as in the base's workflows."),
      new LaunchSetting(["--use-fake-device-for-media-stream"],
        "Gives the engine a stand-in camera and microphone, so a refused camera or microphone is the base's refusal rather than a runner with no device; it grants nothing."),
      new LaunchSetting([`--host-resolver-rules=${LaunchSettings.HOST_RESOLVER_RULES}`],
        "Fails every lookup but localhost, .localhost names and 127.0.0.1, where the recording proxy listens, which keep the engine's own loopback, and loopback.example, "
          + "which it maps to 127.0.0.1 as a name that isn't local but resolves to this computer; a fixture server's .test name doesn't resolve, as the recording proxy reaches it."),
      new LaunchSetting([`--proxy-server=${proxy}`],
        "Sends every request for an address that isn't loopback to the recording proxy, which records it and answers none, so a request the base fails to refuse never leaves the machine; "
          + "a request for a fixture server's .test name, which stands for a public site, it passes to that server, so the base judges that name as a public one."),
      new LaunchSetting(["--proxy-bypass-list=loopback.example"], "Lets loopback.example reach its fixture server on 127.0.0.1 directly, so the base judges the address the engine connected to."),
      ...process.platform === "darwin" ? [new LaunchSetting(["-ApplePersistenceIgnoreState", "YES"], "No restored windows from an earlier run on macOS.")] : [],
      ...Object.isNull(deviceScale) ? [] : [new LaunchSetting([`--force-device-scale-factor=${String(deviceScale)}`],
        "Forces the device scale factor, only in the screenshot scale workflow, so its captures have the scale it names on any display.")]
    ];
  }
}

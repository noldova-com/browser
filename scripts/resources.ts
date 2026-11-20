/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class Resources {
  public static readonly posixSeparator: string = "/";
  public static readonly windowsSeparator: string = "\\";
  public static readonly lineFeed: string = "\n";
  public static readonly nullSeparator: string = "\0";
  public static readonly versionSeparator: string = ".";
  public static readonly listSeparator: string = ",";
  public static readonly statementEnd: string = ";";
  public static readonly textEncoding: BufferEncoding = "utf8";
  public static readonly headerEncoding: BufferEncoding = "latin1";
  public static readonly jsonIndent: number = 2;
  public static readonly windowsPlatform: string = "win32";
  public static readonly pathVariable: string = "PATH";
  public static readonly npmPathVariable: string = "npm_execpath";
  public static readonly npmCommand: string = "npm";
  public static readonly ignoredStdio: "ignore" = "ignore";
  public static readonly pipedStdio: "pipe" = "pipe";
  public static readonly inheritedStdio: "inherit" = "inherit";
  public static readonly outputLimit: number = 16 * 1024 * 1024;
  public static readonly signalExitCode: number = 128;
  public static readonly gitCommand: string = "git";
  public static readonly gitTimeout: number = 60_000;
  public static readonly gitSuccessCodes: readonly number[] = [0];
  public static readonly notExecutableCodes: readonly string[] = ["ENOENT", "ENOTDIR", "EACCES"];
  public static readonly npmTimeout: number = 600_000;
  public static readonly npmUnavailable: string = "npm_execpath is not set; run this through npm, such as npm run build or npm test.";
  public static readonly modulesFolder: string = "node_modules";
  public static readonly sourceFolder: string = "src";
  public static readonly testsFolder: string = "tests";
  public static readonly apiFolder: string = "api";
  public static readonly windowEntry: string = "window.ts";
  public static readonly runtimeFolder: string = "runtime";
  public static readonly moduleFolder: string = "src/noldova.browser";
  public static readonly protocolFolder: string = "src/noldova.browser.protocol";
  public static readonly windowFolder: string = "src/noldova.browser.window";
  public static readonly packageFolders: readonly string[] = [Resources.protocolFolder, Resources.windowFolder, Resources.moduleFolder];
  public static readonly archivesFolder: string = "_packages";
  public static readonly workSegments: readonly string[] = ["_build", "packages"];
  public static readonly compiledSegments: readonly string[] = ["_build", "browser"];
  public static readonly gitFolder: string = ".git";
  public static readonly manifestFile: string = "package.json";
  public static readonly moduleFile: string = "module.json";
  public static readonly settingsFile: string = "settings.json";
  public static readonly versionFile: string = "version.json";
  public static readonly versionFiles: readonly string[] = [Resources.versionFile, Resources.manifestFile];
  public static readonly licenseFile: string = "LICENSE";
  public static readonly readmeFile: string = "README.md";
  public static readonly projectFile: string = "tsconfig.json";
  public static readonly specProjectFile: string = "tsconfig.spec.json";
  public static readonly moduleFiles: readonly string[] = [Resources.moduleFile, Resources.settingsFile, "menus.json", "cli.json", "webViews.json"];
  public static readonly sourceExtension: string = ".ts";
  public static readonly declarationExtension: string = ".d.ts";
  public static readonly scriptExtension: string = ".js";
  public static readonly archiveExtension: string = ".tgz";
  public static readonly manifestExport: string = `./${Resources.manifestFile}`;
  public static readonly declarationImportPattern: RegExp = /(from\s+"\.{1,2}\/[^"]*)\.d\.ts"/g;
  public static readonly declarationImportReplacement: string = `$1${Resources.scriptExtension}"`;
  public static readonly scope: string = "@noldova";
  public static readonly scopePrefix: string = `${Resources.scope}/`;
  public static readonly modulePackageName: string = "@noldova/browser";
  public static readonly ownPackagePrefix: string = `${Resources.modulePackageName}.`;
  public static readonly angularPrefix: string = "@angular/";
  public static readonly desktopPrefix: string = "@noldova/desktop.";
  public static readonly contextPrefix: string = "@noldova/context.";
  public static readonly rangedPrefixes: readonly string[] = [Resources.desktopPrefix, Resources.contextPrefix];
  public static readonly peerPrefixes: readonly string[] = [Resources.angularPrefix, ...Resources.rangedPrefixes];
  public static readonly uiKitNames: readonly string[] = ["@noldova/ui.components.angular"];
  public static readonly idField: string = "id";
  public static readonly nameField: string = "name";
  public static readonly settingsField: string = "settings";
  public static readonly defaultField: string = "default";
  public static readonly versionField: string = "version";
  public static readonly displayNameField: string = "displayName";
  public static readonly descriptionField: string = "description";
  public static readonly partsField: string = "parts";
  public static readonly dependenciesField: string = "dependencies";
  public static readonly devDependenciesField: string = "devDependencies";
  public static readonly optionalDependenciesField: string = "optionalDependencies";
  public static readonly peersField: string = "peerDependencies";
  public static readonly peersMetaField: string = "peerDependenciesMeta";
  public static readonly optionalField: string = "optional";
  public static readonly noldovaDesktopField: string = "noldovaDesktop";
  public static readonly contributesField: string = "contributes";
  public static readonly exportsField: string = "exports";
  public static readonly privateField: string = "private";
  public static readonly commitField: string = "gitHead";
  public static readonly moduleFields: readonly string[] = [
    Resources.idField,
    Resources.versionField,
    Resources.displayNameField,
    Resources.descriptionField,
    Resources.partsField,
    Resources.dependenciesField,
    Resources.noldovaDesktopField,
    Resources.contributesField
  ];
  public static readonly textFields: readonly string[] = [Resources.displayNameField, Resources.descriptionField];
  public static readonly dependencyFields: readonly string[] = [Resources.dependenciesField, Resources.devDependenciesField, Resources.optionalDependenciesField, Resources.peersField];
  public static readonly pinFields: readonly string[] = [Resources.dependenciesField, Resources.peersField, Resources.optionalDependenciesField];
  public static readonly partNames: readonly string[] = [Resources.runtimeFolder, "window", "cli"];
  public static readonly toolsKind: string = "tools";
  public static readonly contributionKinds: readonly string[] = [
    "methods", "events", "commands", "notifications", "views", "documents", "statusBarItems", "topBarActions", "menus", "themes", "settings", "settingScopes",
    "cliCommands", Resources.toolsKind
  ];
  public static readonly reservedModuleId: string = "desktop";
  public static readonly moduleIdSeparator: string = "-";
  public static readonly toolNameSeparator: string = "_";
  public static readonly idPattern: RegExp = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
  public static readonly versionPattern: RegExp = /^(?:0|[1-9][0-9]{0,8})\.(?:0|[1-9][0-9]{0,8})\.(?:0|[1-9][0-9]{0,8})$/;
  public static readonly namePattern: RegExp = /^[a-z][a-zA-Z0-9]*$/;
  public static readonly toolPattern: RegExp = /^[a-z][a-z0-9_]{0,63}$/;
  public static readonly declarationPinPattern: RegExp = /^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/;
  public static readonly archivePinPattern: RegExp = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/;
  public static readonly rangePattern: RegExp = /^>=((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)) <((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))$/;
  public static readonly scopePattern: RegExp = /^@([^/]+)\/(.+)$/;
  public static readonly scopeReplacement: string = "$1-$2";
  public static readonly packageManifest: string = "The package's manifest";
  public static readonly windowPackageManifest: string = "The window package's manifest";
  public static readonly rootManifest: string = "The root manifest";
  public static readonly packageManifestName: string = "the package's manifest";
  public static readonly windowPackageManifestName: string = "the window package's manifest";
  public static readonly moduleIdInvalid: string = "module.json's id must be lowercase kebab-case and not \"desktop\".";
  public static readonly moduleVersionInvalid: string = "module.json's version must be <major>.<minor>.<patch>, three whole numbers of up to nine digits without leading zeros.";
  public static readonly moduleDependenciesInvalid: string = "module.json's dependencies must be an object from module ids to exact versions.";
  public static readonly moduleContributesInvalid: string = "module.json's contributes must be an object.";
  public static readonly moduleFieldsInvalid: string = `module.json must have exactly the fields ${Resources.moduleFields.join(", ")}.`;
  public static readonly packageNameRequired: string = `The package's manifest must name it ${Resources.modulePackageName}.`;
  public static readonly packageVersionDiffers: string = "The package's manifest and module.json must have the same version.";
  public static readonly packagePeersInvalid: string = `The package's manifest's ${Resources.peersField} must be an object.`;
  public static readonly packagePrivate: string = "The package's manifest must not be private: the module ships as published packages.";
  public static readonly noldovaDesktopInvalid: string = "module.json's noldovaDesktop must be >=<lowest> <first refused>, from the Noldova Desktop version the module builds against to the next minor below 1.0, or the next major from 1.0.";
  public static readonly rangeForm: string = "a range of the form >=<lowest> <first refused>";
  public static readonly rangeAlternative: string = ` or ${Resources.rangeForm}`;
  public static readonly peerRangeAlternative: string = `, or ${Resources.rangeForm},`;
  public static readonly angularForm: string = "a range of the form >=<the Angular it builds with> <the next major>";
  public static readonly nothingText: string = "nothing";
  public static readonly missingText: string = "missing";
  public static readonly archiveFolder: string = "package";
  public static readonly manifestEntryName: string = `${Resources.archiveFolder}/${Resources.manifestFile}`;
  public static readonly moduleEntryName: string = `${Resources.archiveFolder}/${Resources.moduleFile}`;
  public static readonly partExports: readonly string[] = ["./runtime", "./window"];
  public static readonly windowSuffix: string = ".window";
  public static readonly archiveBlock: number = 512;
  public static readonly archiveNameEnd: number = 100;
  public static readonly archiveSizeStart: number = 124;
  public static readonly archiveSizeEnd: number = 136;
  public static readonly archiveTypeAt: number = 156;
  public static readonly archivePrefixStart: number = 345;
  public static readonly archivePrefixEnd: number = 500;
  public static readonly archiveSizeRadix: number = 8;
  public static readonly archiveFileTypes: readonly string[] = ["0", "\0"];
  public static readonly archiveExtendedType: string = "x";
  public static readonly archivePathRecord: RegExp = /^\d+ path=(.*)$/m;
  public static readonly archiveFieldEnd: RegExp = /\0.*$/s;
  public static readonly packageImportPattern: RegExp = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)(["'])((?:@[^/"']+\/)?[^/"'.][^/"']*)(?:\/[^"']*)?\1/g;
  public static readonly quotes: readonly string[] = ["\"", "'", "`"];
  public static readonly escapeCharacter: string = "\\";
  public static readonly commentSlash: string = "/";
  public static readonly commentStar: string = "*";
  public static readonly blockCommentStart: string = "/*";
  public static readonly blockCommentEnd: string = "*/";
  public static readonly packArguments: readonly string[] = ["pack", "--ignore-scripts", "--loglevel=error", "--pack-destination"];
  public static readonly archiveInstallArguments: readonly string[] = ["install", "--no-save", "--ignore-scripts", "--no-audit", "--no-fund", "--loglevel=error"];
  public static readonly statusArguments: readonly string[] = ["status", "--porcelain"];
  public static readonly commitArguments: readonly string[] = ["rev-parse", "HEAD"];
  public static readonly trackedSourcesArguments: readonly string[] = ["ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", Resources.sourceFolder];
  public static readonly listCopiesOption: string = "--list-copies";
  public static readonly endOfCopies: string = "end of copies\n";
  public static readonly runThroughNpmRunBuild: string = "Run it with npm run build, which installs the dependencies through npm.";
  public static readonly installingPackages: string = "Installing npm packages…";
  public static readonly cleanInstallArguments: readonly string[] = ["ci", "--ignore-scripts", "--no-audit", "--no-fund"];
  public static readonly projectOption: string = "--project";
  public static readonly typeScriptCompiler: readonly string[] = [Resources.modulesFolder, "typescript", "bin", "tsc"];
  public static readonly compilerManifest: readonly string[] = [Resources.modulesFolder, "@angular", "compiler-cli", Resources.manifestFile];
  public static readonly compilerCommand: string = "ngc";
  public static readonly compilerProjectOption: string = "-p";
  public static readonly partialCompilationMode: string = "partial";
  public static readonly angularWorkSegments: readonly string[] = ["_build", "angular"];
  public static readonly angularWorkPrefix: string = "noldova-angular-package-";
  public static readonly angularCompileTimeout: number = 300_000;
  public static readonly cdkPackage: string = "@angular/cdk";
  public static readonly cdkListArguments: readonly string[] = ["ls", Resources.cdkPackage, "--all", "--json", "--long"];
  public static readonly cdkListCommand: string = `${Resources.npmCommand} ${Resources.cdkListArguments.join(" ")}`;
  public static readonly npmListDependencies: string = "dependencies";
  public static readonly npmListVersion: string = "version";
  public static readonly npmListPath: string = "path";
  public static readonly npmListError: string = "error";
  public static readonly npmListCode: string = "code";
  public static readonly npmListSummary: string = "summary";
  public static readonly npmListProblemsCode: string = "ELSPROBLEMS";
  public static readonly cdkCopyMissing: string = `npm ls found no ${Resources.cdkPackage} in the root install, so the check read nothing.\n`;
  public static readonly cdkCopyFound: string = `Found one copy of ${Resources.cdkPackage} in the root install.\n`;
  public static readonly cdkOneCopyAdvice: string = "Install the version the UI kit pins, so npm keeps one copy.\n";
  public static readonly classMetadataPluginName: string = "noldova-class-metadata-coverage";
  public static readonly classMetadataOpening: string = "(() => {";
  public static readonly classMetadataClosing: string = "})();";
  public static readonly classMetadataCallPattern: RegExp = /^[\t ]+\(typeof ngDevMode === "undefined" \|\| ngDevMode\) && i\d+\.(?:ɵ|\\u0275)setClassMetadata\(([A-Za-z_$][\w$]*), /u;
  public static readonly coverageIgnoreHint: string = " /* v8 ignore next */";
  public static readonly testFilePattern: RegExp = /\.[cm]?[jt]sx?$/;
  public static readonly waitForTimeoutPattern: RegExp = /\bwaitForTimeout\b/g;
  public static readonly atomicsWaitPattern: RegExp = /\bAtomics\s*\.\s*wait(?:Async)?\b/g;
  public static readonly newPromisePattern: RegExp = /\bnew\s+Promise\b/g;
  public static readonly promisifiedTimerPattern: RegExp = /\bpromisify\s*\(\s*set(?:Timeout|Interval)\b/g;
  public static readonly timerPattern: RegExp = /\bset(?:Timeout|Interval)\b/;
  public static readonly whitespacePattern: RegExp = /\s/;
  public static readonly whitespaceRunPattern: RegExp = /\s+/g;
  public static readonly timersModulePattern: RegExp = /["'`](?:node:)?timers\/promises["'`]/g;
  public static readonly namedImportPattern: RegExp = /\bimport\s+(?:type\s+)?\{([^}]*)\}\s*from\s*$/;
  public static readonly namespaceImportPattern: RegExp = /\bimport\s+(?:\*\s+as\s+)?([A-Za-z_$][\w$]*)\s+from\s*$/;
  public static readonly destructuredLoadPattern: RegExp = /\b(?:const|let|var)\s+\{([^}]*)\}\s*=\s*(?:await\s+import|require)\s*\(\s*$/;
  public static readonly namespaceLoadPattern: RegExp = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+import|require)\s*\(\s*$/;
  public static readonly aliasPattern: RegExp = /\s+as\s+|\s*:\s*/;
  public static readonly dollarPattern: RegExp = /\$/g;
  public static readonly escapedDollar: string = "\\$";
  public static readonly globalFlag: string = "g";
  public static readonly openParenthesis: string = "(";
  public static readonly closeParenthesis: string = ")";
  public static readonly openAngle: string = "<";
  public static readonly closeAngle: string = ">";
  public static readonly arrowStart: string = "=";
  public static readonly timerNames: readonly string[] = ["setTimeout", "setInterval"];
  public static readonly schedulerName: string = "scheduler";
  public static readonly waitForTimeoutForm: string = "Playwright's waitForTimeout";
  public static readonly timerPromiseForm: string = "a promise that setTimeout or setInterval resolves";
  public static readonly timersModuleForm: string = "a timer from node:timers/promises";
  public static readonly timersModuleUnfollowedForm: string = "a load of node:timers/promises that the check can't follow";
  public static readonly schedulerWaitForm: string = "scheduler.wait from node:timers/promises";
  public static readonly pauseFilesMissing: string = "The pause check found no test file under src/*/tests/ or src/*/*/tests/, so it read nothing.\n";
  public static readonly componentSourcePattern: RegExp = /\.m?ts$/u;
  public static readonly changeDetectionPattern: RegExp = /\bchangeDetection\s*:(?!\s*ChangeDetectionStrategy\.Eager\b)/gu;
  public static readonly onPushFilesMissing: string = "The OnPush check found no TypeScript file under src/, so it read nothing.\n";
  public static readonly optionPrefix: string = "--";
  public static readonly skipTestDetails: string = "--skip-test-details";
  public static readonly skipCoverageDetails: string = "--skip-coverage-details";
  public static readonly testOptions: readonly string[] = [Resources.skipTestDetails, Resources.skipCoverageDetails];
  public static readonly dotReporter: string = "--reporter=dot";
  public static readonly skipFullCoverage: string = "--coverage.skipFull";
  public static readonly coverageMetrics: readonly string[] = ["statements", "branches", "functions", "lines"];
  public static readonly ciVariable: string = "CI";
  public static readonly debugVariable: string = "DEBUG";
  public static readonly browserSessionDebug: string = "vitest:browser:pool,vitest:browser:playwright,vitest:browser:api";
  public static readonly vitestArguments: readonly string[] = [`${Resources.modulesFolder}/vitest/vitest.mjs`, "run", "--coverage"];
  public static readonly defaultReporter: string = "--reporter=default";
  public static readonly testTimesReport: string = "_build/test-times.json";
  public static readonly jsonReporter: readonly string[] = ["--reporter=json", `--outputFile.json=${Resources.testTimesReport}`];
  public static readonly testTimeCheck: string = "scripts/checks/test-time-check.ts";
  public static readonly testTimeUsage: string = "Give the Vitest JSON report, such as: node scripts/checks/test-time-check.ts _build/test-times.json";
  public static readonly vitestFiles: string = "testResults";
  public static readonly vitestTests: string = "assertionResults";
  public static readonly vitestName: string = "fullName";
  public static readonly vitestFileName: string = "name";
  public static readonly vitestStartTime: string = "startTime";
  public static readonly vitestEndTime: string = "endTime";
  public static readonly vitestDuration: string = "duration";
  public static readonly unitFileBudget: number = 1_000;
  public static readonly specMedianBudget: number = 100;
  public static readonly slowComponentTest: number = 1_000;
  public static readonly timingRuns: number = 3;
  public static readonly timingMargin: number = 1.2;
  public static readonly timingFolder: readonly string[] = ["_build", "timing"];
  public static readonly unitTimingName: string = "unit";
  public static readonly specTimingName: string = "specs";
  public static readonly outputFileJsonOption: string = "--outputFile.json=";
  public static readonly unitTimingArguments: readonly string[] = [`${Resources.modulesFolder}/vitest/vitest.mjs`, "run", "--reporter=dot", "--reporter=json"];
  public static readonly specTimingArguments: readonly string[] = ["test", "--reporters=default", "--reporters=json", "--no-coverage", "--output-file"];
  public static readonly tableRowPrefix: string = "|";
  public static readonly slowFileListHeader: string = "| Test file | Time | Why |";
  public static readonly slowSpecListHeader: string = "| Spec file | Median test | Why |";
  public static readonly slowFileListRow: RegExp = /^\| `([^`]+)` \| [^|]+ \| .+ \|$/u;
  public static readonly typeScriptCompilerPath: string = Resources.typeScriptCompiler.join(Resources.posixSeparator);
  public static readonly testChecks: readonly (readonly string[])[] = [
    ["scripts/checks/pause-check.ts"],
    ["scripts/checks/on-push-check.ts"],
    ["scripts/declarations/declaration-check.ts"],
    ["scripts/checks/api-declaration-check.ts"],
    ["scripts/checks/api-example-check.ts"],
    [Resources.typeScriptCompilerPath, Resources.projectOption, `scripts/${Resources.projectFile}`],
    [Resources.typeScriptCompilerPath, Resources.projectOption, `${Resources.protocolFolder}/${Resources.specProjectFile}`],
    [Resources.typeScriptCompilerPath, Resources.projectOption, `${Resources.moduleFolder}/${Resources.specProjectFile}`]
  ];
  public static readonly installedPackageTest: string = "scripts/tests/installed-package/install-and-activate.ts";
  public static readonly fixtureArchivePrefix: string = "noldova-browser";
  public static readonly fixtureArchiveCount: number = 3;
  public static readonly fixturePeers: readonly string[] = ["@noldova/desktop.runtime", "@noldova/desktop.protocol", "@noldova/context.core",
    "@noldova/context.exceptions", "@noldova/context.json", "@noldova/context.text", "@noldova/context.collections", "@types/node", "undici-types",
    "@noldova/desktop.window", "@noldova/ui.components.angular", "@angular/core", "@angular/common", "@angular/cdk", "@angular/forms", "@angular/platform-browser",
    "rxjs", "tslib"];
  public static readonly runnerTempVariable: string = "RUNNER_TEMP";
  public static readonly fixtureWorkPrefix: string = "noldova-browser-fixture-";
  public static readonly fixtureAppFolder: string = "fixture-app";
  public static readonly fixturePeersFolder: string = "fixture-peers";
  public static readonly fixtureActivateScript: string = "scripts/tests/installed-package/activate-browser.ts";
  public static readonly fixtureWindowDeclarations: string = "scripts/tests/installed-package/window-declarations.ts";
  public static readonly fixtureScriptFiles: readonly string[] = [Resources.fixtureActivateScript, Resources.fixtureWindowDeclarations, "scripts/resources.ts",
    "scripts/exceptions/script.exception.ts", "scripts/exceptions/installed-package.exception.ts"];
  public static readonly fixtureManifest: string = `${JSON.stringify({ name: "fixture-app", private: true, type: "module" }, null, 2)}\n`;
  public static readonly fixtureProject: string = `${JSON.stringify({
    compilerOptions: {
      target: "ES2025", lib: ["ES2025", "ESNext.Disposable", "DOM"], module: "NodeNext", moduleResolution: "NodeNext", strict: true,
      exactOptionalPropertyTypes: true, noUncheckedIndexedAccess: true, skipLibCheck: false, noEmit: true, allowImportingTsExtensions: true,
      erasableSyntaxOnly: true, verbatimModuleSyntax: true, types: ["node"]
    },
    files: [Resources.fixtureActivateScript, Resources.fixtureWindowDeclarations]
  }, null, 2)}\n`;
  public static readonly installedRuntimePackage: string = `${Resources.modulePackageName}/runtime`;
  public static readonly installedWindowPackage: string = `${Resources.modulePackageName}/window`;
  public static readonly installedDeclarations: readonly string[] = [Resources.moduleFile, Resources.settingsFile, "menus.json", "webViews.json"];
  public static readonly installedModuleId: string = "browser";
  public static readonly installedView: string = "view-1";
  public static readonly installedProfileKey: string = "workspace-1";
  public static readonly installedPaneName: string = "page";
  public static readonly installedTypedMethod: string = "browser.allowTypedAddress";
  public static readonly installedTypedUrl: string = "https://docs.example.com/pricing";
  public static readonly installedTypedOrigin: string = "https://docs.example.com";
  public static readonly installedTools: readonly string[] = ["browser_navigate", "browser_snapshot", "browser_click", "browser_type", "browser_press_key",
    "browser_screenshot", "browser_console", "browser_wait_for"];
  public static readonly installedKeptOrigins: string = "SELECT origin FROM allowed_origins WHERE profile_key = ?";
  public static readonly installedConnection: number = 1;
  public static readonly installedWindow: number = 1;
  public static readonly installedNotFollowing: string = "The installed runtime part does not follow one view listener and both session listeners.";
  public static readonly installedWrongTools: string = "The installed runtime part registered other tools.";
  public static readonly installedTypedMethodMissing: string = `The installed runtime part did not register ${Resources.installedTypedMethod}.`;
  public static readonly installedWrongAnswer: string = "The installed runtime part answered the typed address otherwise.";
  public static readonly installedNotKept: string = "The installed runtime part did not keep the typed address's origin.";
  public static readonly installedNotGiven: string = `The installed runtime part did not give ${Resources.installedView} the typed address's origin.`;
  public static readonly installedStillFollowing: string = "The runtime part still follows Noldova Desktop after it deactivated.";
  public static readonly installedOriginsGiven: string = `Gave ${Resources.installedView} its workspace's origins from the installed package.`;
  public static readonly installedOriginKept: string = "Kept the typed address's origin in the installed part's database.";
  public static readonly fixturePackArguments: readonly string[] = ["pack", "--ignore-scripts", "--silent"];
  public static readonly fixtureInstallArguments: readonly string[] = ["install", "--no-audit", "--no-fund", "--ignore-scripts", "--legacy-peer-deps"];
  public static readonly fixtureArchivesMissing: string = "_packages must hold the module's three archives; run npm run build first.";
  public static readonly fixturePeersMissing: string = "node_modules must hold Noldova Desktop's runtime and the packages it depends on; run npm run build first.";
  public static readonly fixtureNpmMissing: string = "Run it with npm test, which installs the fixture app through npm.";
  public static readonly windowSpecPrefix: string = `${Resources.windowFolder}/`;
  public static readonly lookSpecSuffix: string = ".look.ts";
  public static readonly angularCompilerEntry: readonly string[] = [Resources.modulesFolder, "@angular", "compiler-cli", "bundles", "src", "bin", "ngc.js"];
  public static readonly angularCliEntry: readonly string[] = [Resources.modulesFolder, "@angular", "cli", "bin", "ng.js"];
  public static readonly playwrightEntry: readonly string[] = [Resources.modulesFolder, "playwright", "cli.js"];
  public static readonly windowTypeCheckArguments: readonly string[] = [Resources.projectOption, Resources.projectFile];
  public static readonly browserInstallArguments: readonly string[] = ["install", "--only-shell", "chromium"];
  public static readonly unitTestArguments: readonly string[] = ["test"];
  public static readonly lookTestArguments: readonly string[] = ["run", "window:test-look"];
  public static readonly noCoverageOption: string = "--coverage=false";
  public static readonly includeOption: string = "--include";

  public static formatAngularCompileFailed(sources: string, exitCode: number | null, output: string): string {
    return `Compiling ${sources} with the Angular compiler failed with exit code ${exitCode}:\n${output}`;
  }

  public static formatAngularCompileTimedOut(sources: string, timeout: number): string {
    return `Compiling ${sources} with the Angular compiler did not finish within ${timeout} ms.`;
  }

  public static formatAngularCompilerCommandMissing(manifest: string, command: string): string {
    return `${manifest} names no ${command} command.`;
  }

  public static formatAngularCompilerMissing(root: string): string {
    return `The root install in ${root} has no Angular compiler to run; npm ci installs one.`;
  }

  public static formatAngularEntriesMissing(entries: string): string {
    return `${entries} has no entry files to compile.`;
  }

  public static formatAngularPeerInvalid(archiveName: string, name: string, pin: unknown, field: string): string {
    return `${archiveName} names ${name} at ${String(pin)} in ${field}, not at ${Resources.angularForm}.`;
  }

  public static formatArchiveCommitDiffers(archiveName: string, found: unknown, commit: string): string {
    return `${archiveName}: its ${Resources.commitField} is ${found === undefined ? Resources.missingText : JSON.stringify(found)}, not "${commit}"; `
      + `a release builds its archives from a clean clone of the commit, which each records as its ${Resources.commitField}.`;
  }

  public static formatArchiveDependencyDiffers(archiveName: string, dependency: string, range: string, version: string): string {
    return `${archiveName}: its dependency ${dependency} is "${range}", not exactly "${version}".`;
  }

  public static formatArchiveEntryMalformed(archive: string, offset: number): string {
    return `${archive} has a malformed or truncated entry at offset ${offset}.`;
  }

  public static formatArchiveEntryPath(prefix: string, name: string): string {
    return `${prefix}${Resources.posixSeparator}${name}`;
  }

  public static formatArchiveExportMissing(archiveName: string, subpath: string, target: string): string {
    return `${archiveName} exports ${subpath} as ${target}, which the archive lacks.`;
  }

  public static formatArchiveExportsNothing(archiveName: string): string {
    return `${archiveName} exports nothing.`;
  }

  public static formatArchiveFieldDiffers(archiveName: string, field: string, found: string, expected: string): string {
    return `${archiveName}: its ${field} is "${found}", not "${expected}".`;
  }

  public static formatArchiveFindings(findings: readonly string[]): string {
    return findings.join(Resources.lineFeed);
  }

  public static formatArchiveFolderMissing(folder: string): string {
    return `There is no folder ${folder} with the archives to release.`;
  }

  public static formatArchiveInstallFailed(archives: readonly string[], exitCode: number | null, output: string): string {
    return `Installing the packed ${archives.join(", ")} failed with exit code ${exitCode}:\n${output}`;
  }

  public static formatArchiveManifestContext(archiveName: string): string {
    return `${archiveName} ${Resources.manifestEntryName}`;
  }

  public static formatArchiveManifestMissing(archiveName: string): string {
    return `${archiveName} has no ${Resources.manifestEntryName}.`;
  }

  public static formatArchiveMarkedPrivate(archiveName: string): string {
    return `${archiveName}: is marked private, so npm would refuse to publish it.`;
  }

  public static formatArchiveMissing(folder: string, archiveName: string): string {
    return `${folder} lacks ${archiveName}.`;
  }

  public static formatArchiveModuleFileInvalid(archiveName: string): string {
    return `${archiveName}'s ${Resources.moduleEntryName} is not a JSON object.`;
  }

  public static formatArchiveModuleFileMissing(archiveName: string): string {
    return `${archiveName} exports the module's parts but lacks module.json at its root.`;
  }

  public static formatArchiveName(name: string, version: string): string {
    return `${name.replace(Resources.scopePattern, Resources.scopeReplacement)}-${version}${Resources.archiveExtension}`;
  }

  public static formatArchiveOutsideScope(archiveName: string, name: string, scope: string): string {
    return `${archiveName}: ${name} is outside the scope ${scope}.`;
  }

  public static formatArchivePeerNotOptional(archiveName: string, peer: string): string {
    return `${archiveName} doesn't mark its peer ${peer} optional, so an app's root install would take a second copy.`;
  }

  public static formatArchivePinInvalid(archiveName: string, name: string, pin: unknown, field: string, isRanged: boolean): string {
    return `${archiveName} names ${name} at ${String(pin)} in ${field}, not at one exact version${isRanged ? Resources.rangeAlternative : ''}.`;
  }

  public static formatArchiveUnexpected(folder: string, fileName: string, version: string): string {
    return `${folder} holds ${fileName}, which is not a package's archive at ${version}.`;
  }

  public static formatArchiveUnreadable(archive: string): string {
    return `${archive} could not be read as a gzipped archive.`;
  }

  public static formatCdkCopiesFound(count: number): string {
    return `The root install holds ${count} copies of ${Resources.cdkPackage}, so the UI kit's overlays and focus handling and the app's would run from different ones:\n`;
  }

  public static formatCdkCopy(version: string, folder: string): string {
    return `  ${version} at ${folder}\n`;
  }

  public static formatCdkListFailed(code: string, summary: string): string {
    return `"${Resources.cdkListCommand}" at the root failed (${code}): ${summary}`;
  }

  public static formatCdkListUnreadable(output: string): string {
    return `"${Resources.cdkListCommand}" at the root gave no list to read: ${output}`;
  }

  public static formatChangeDetectionRefused(file: string, line: number): string {
    return `${file}:${line} sets a changeDetection other than Eager; OnPush is the default since Angular 22, so leave the strategy out, and write one only to choose Eager, with the reason.\n`;
  }

  public static formatClassMetadataIgnored(calls: number, classes: number): string {
    return `Coverage ignores ${calls} compiler-generated class-metadata calls for ${classes} classes, which run only in development mode.`;
  }

  public static formatCompileFailed(folder: string, exitCode: number): string {
    return `Compiling ${folder} failed with exit code ${exitCode}; TypeScript's errors are above.`;
  }

  public static formatCompiledMissing(folder: string): string {
    return `${folder} doesn't exist; the module's TypeScript build writes it.`;
  }

  public static formatExportSourceInvalid(file: string, subpath: string): string {
    return `${file}'s export ${subpath} must name a ${Resources.sourceExtension} source.`;
  }

  public static formatExportsInvalid(file: string): string {
    return `${file}'s ${Resources.exportsField} must map each subpath to a source.`;
  }

  public static formatFieldContext(context: string, key: string): string {
    return `${context}.${key}`;
  }

  public static formatFieldNotObject(owner: string, field: string): string {
    return `${owner}'s ${field} must be an object.`;
  }

  public static formatFirstMajorRefused(major: number): string {
    return `${major}.0.0`;
  }

  public static formatFirstMinorRefused(minor: number): string {
    return `0.${minor}.0`;
  }

  public static formatGitFailed(gitArguments: readonly string[], exitCode: number | null, errorOutput: string): string {
    return `"${Resources.gitCommand} ${gitArguments.join(" ")}" failed with exit code ${exitCode}: ${errorOutput}`;
  }

  public static formatGitHubObjectExpected(context: string): string {
    return `${context} must be an object.`;
  }

  public static formatGitHubTextExpected(context: string, key: string): string {
    return `${Resources.formatFieldContext(context, key)} must be text.`;
  }

  public static formatInstalledDeclarationMissing(file: string, declaration: string): string {
    return `The installed module package holds no ${file} at ${declaration}.`;
  }

  public static formatInstalledLogged(messages: readonly string[]): string {
    return `The runtime part logged: ${messages.join(" | ")}`;
  }

  public static formatInstalledRuntimePart(entry: string): string {
    return `Runtime part: ${entry}`;
  }

  public static formatInstalledWindowPart(entry: string): string {
    return `Window part: ${entry}`;
  }

  public static formatJsonObjectRequired(file: string): string {
    return `${file} must be a JSON object.`;
  }

  public static formatJsonObjectUnreadable(context: string): string {
    return `${context} is not a JSON object.`;
  }

  public static formatListFilesFailed(detail: string): string {
    return `git ls-files failed: ${detail}\n`;
  }

  public static formatListedCopy(source: string, name: string, entry: string): string {
    return `${source}\t${name}\t${entry}\n`;
  }

  public static formatManifestPinInvalid(description: string, name: string, field: string): string {
    return `${description} must pin ${name} at an exact version in ${field}.`;
  }

  public static formatModuleContributionInvalid(kind: string, name: string, id: string): string {
    return `module.json's ${kind} entry ${name} must have the form ${id}.<camelCaseName>.`;
  }

  public static formatModuleDependencyInvalid(dependency: string): string {
    return `module.json names an invalid dependency: ${dependency}.`;
  }

  public static formatModuleDependencyVersionInvalid(dependency: string): string {
    return `module.json must name ${dependency} at an exact version in dependencies.`;
  }

  public static formatModuleKindUnknown(kind: string): string {
    return `module.json contributes an unknown kind: ${kind}.`;
  }

  public static formatModuleListInvalid(field: string): string {
    return `module.json's ${field} must be a list of names.`;
  }

  public static formatModuleListRepeats(field: string): string {
    return `module.json's ${field} lists a name twice.`;
  }

  public static formatModulePartExportMissing(part: string): string {
    return `module.json's part ${part} has no export ${Resources.formatPartExport(part)} in ${Resources.moduleFolder}/${Resources.manifestFile} to a file the package holds.`;
  }

  public static formatModulePartUnknown(part: string): string {
    return `module.json names an unknown part: ${part}.`;
  }

  public static formatModuleTextBlank(field: string): string {
    return `module.json's ${field} must be text that is not blank.`;
  }

  public static formatModuleVersionDiffers(file: string, found: string, version: string): string {
    return `${file} has the version ${found}; the module's packages are at ${Resources.moduleFile}'s version, ${version}.`;
  }

  public static formatNoCoverageGate(metric: string): string {
    return `--coverage.thresholds.${metric}=0`;
  }

  public static formatNoldovaDesktopBuildOutsideRange(name: string, pin: string, noldovaDesktop: string): string {
    return `The module builds against ${name} ${pin}, outside module.json's noldovaDesktop ${noldovaDesktop}.`;
  }

  public static formatNoldovaDesktopMissing(file: string): string {
    return `${file} names no ${Resources.noldovaDesktopField} of the form >=<lowest> <first refused>.`;
  }

  public static formatNoldovaDesktopPeerDiffers(archiveName: string, name: string, pin: unknown, field: string, noldovaDesktop: string): string {
    return `${archiveName} names ${name} at ${String(pin)} in ${field}, not at module.json's ${Resources.noldovaDesktopField}, ${noldovaDesktop}.`;
  }

  public static formatNoldovaDesktopRangeInvalid(archiveName: string, found: unknown): string {
    return `${archiveName}'s ${Resources.moduleEntryName} names ${Resources.noldovaDesktopField} ${found === undefined ? Resources.nothingText : JSON.stringify(found)}, `
      + `not ${Resources.rangeForm}.`;
  }

  public static formatNoldovaDesktopRangesDiffer(ranges: readonly string[]): string {
    return `The archives' module.json files name different ${Resources.noldovaDesktopField} ranges, ${ranges.join(" and ")}; the repository's modules build against one.`;
  }

  public static formatObjectRequired(path: string): string {
    return `${path} must hold a JSON object.`;
  }

  public static formatOwnPinDiffers(file: string, name: string, pin: string, version: string): string {
    return `${file} pins ${name} at ${pin}; the module's own packages are at its version, ${version}.`;
  }

  public static formatPackFailed(packageName: string, exitCode: number | null, output: string): string {
    return `Packing ${packageName} failed with exit code ${exitCode}:\n${output}`;
  }

  public static formatPackageNameMissing(file: string): string {
    return `${file} has no name.`;
  }

  public static formatPackageNoldovaDesktopPeerDiffers(name: string, noldovaDesktop: string): string {
    return `The package's manifest must name ${name} at module.json's noldovaDesktop, ${noldovaDesktop}, in ${Resources.peersField}.`;
  }

  public static formatPackagePeerPinInvalid(name: string, isRanged: boolean): string {
    return `The package's manifest must pin ${name} at an exact version${isRanged ? Resources.peerRangeAlternative : ''} in ${Resources.peersField}.`;
  }

  public static formatPackagePrivate(file: string): string {
    return `${file} is private, so it can't be packed for publishing.`;
  }

  public static formatPartExport(part: string): string {
    return `./${part}`;
  }

  public static formatPauseRefusal(file: string, line: number, form: string): string {
    return `${file}:${line}: ${form}\n`;
  }

  public static formatPauseTestsMissing(folder: string): string {
    return `${folder} has no tests folder, nor has any of its parts, so the pause check can't read its tests.\n`;
  }

  public static formatPackageSpec(name: string, version: string): string {
    return `${name}@${version}`;
  }

  public static formatPeerManifestUnreadable(dependency: string, file: string): string {
    return `The manifest of ${dependency} at ${file} can't be read after the move.`;
  }

  public static formatPeerMoved(dependency: string, version: string): string {
    return `Moved ${dependency} to ${version}, the newest published version inside the packages' peer ranges.`;
  }

  public static formatPeerMoveFailed(exitCode: number | null, output: string): string {
    return `Installing the newest peers inside their ranges at the root failed with exit code ${exitCode}:${Resources.lineFeed}${output}`;
  }

  public static formatPeerNotMoved(dependency: string, installed: string, version: string): string {
    return `The root's node_modules holds ${dependency} ${installed} after the move, not ${version}.`;
  }

  public static formatPeerNoVersion(dependency: string, ranges: readonly string[]): string {
    return `No published version of ${dependency} is inside every package's peer range: ${ranges.join(", ")}.`;
  }

  public static formatPeerRangeInvalid(dependency: string, range: string): string {
    return `A package's manifest gives ${dependency} the peer range ${range}, which isn't ${Resources.rangeForm}.`;
  }

  public static formatPeerVersionsNotJson(dependency: string, output: string): string {
    return `npm view ${dependency} versions gave output that isn't JSON:${Resources.lineFeed}${output}`;
  }

  public static formatPeerVersionsUnread(dependency: string, exitCode: number | null, output: string): string {
    return `npm view ${dependency} versions failed with exit code ${exitCode}:${Resources.lineFeed}${output}`;
  }

  public static formatVersionsViewArguments(dependency: string): readonly string[] {
    return ["view", dependency, "versions", "--json"];
  }

  public static formatPinDiffers(name: string, manifest: string): string {
    return `${name} must be pinned at the same version in the root manifest and ${manifest}.`;
  }

  public static formatPinMissing(name: string, file: string): string {
    return `The window part imports ${name}, which ${file} doesn't pin.`;
  }

  public static formatProcessNotStarted(command: string): string {
    return `"${command}" could not start.`;
  }

  public static formatProcessOutputTooLong(command: string, limit: number): string {
    return `"${command}" wrote more than ${limit} bytes.`;
  }

  public static formatProcessTimedOut(command: string, timeout: number): string {
    return `"${command}" did not finish within ${timeout} ms.`;
  }

  public static formatRange(lowest: string, refused: string): string {
    return `>=${lowest} <${refused}`;
  }

  public static formatReadFailed(path: string, error: unknown): string {
    return `Could not read ${path}: ${String(error)}`;
  }

  public static formatReadmeMissing(folder: string, packageName: string): string {
    return `${folder} lacks ${Resources.readmeFile}, which npm shows as ${packageName}'s page.`;
  }

  public static formatRootPinUnlisted(name: string): string {
    return `${name} is pinned in the root manifest, so the package's manifest or the window package's manifest must list it.`;
  }

  public static formatSchedulerWaitPattern(name: string): string {
    return `\\b${name}\\s*\\.\\s*wait\\b`;
  }

  public static formatSlowComponentTest(file: string, title: string, duration: number): string {
    return `  slow: ${file} "${title}" took ${Math.round(duration)} ms; README.md lists each component test over ${Resources.slowComponentTest} ms with its cause.`;
  }

  public static formatSpecMedian(file: string, median: number, tests: number, isOver: boolean, isAccepted: boolean): string {
    return `${isOver ? (isAccepted ? "accepted" : "OVER") : "ok"} ${file}: median test ${median.toFixed(1)} ms over ${tests} tests${isOver ? `, over the ${Resources.specMedianBudget} ms the bar sets, with its margin` : ""}.`;
  }

  public static formatTakesNoOtherOption(option: string): string {
    return `${option} takes no other option.`;
  }

  public static formatTestFileSlow(file: string, time: number): string {
    return `${file}: ${Math.round(time)} ms, over the ${Resources.unitFileBudget} ms a unit test file may take; npm run test:timing decides, from the median of several runs.`;
  }

  public static formatTestOptionsRefused(unknown: readonly string[]): string {
    return `npm test takes ${Resources.testOptions.join(" and ")}, then any test files, not ${unknown.join(", ")}.`;
  }

  public static formatTestTimesChecked(files: number, over: number, accepted: number): string {
    return `Timed ${files} test files: ${over} took over ${Resources.unitFileBudget} ms in this run, ${accepted} of them accepted in README.md; this run reports times only, and npm run test:timing checks them.`;
  }

  public static formatTimerImportForm(name: string): string {
    return `${name} from node:timers/promises`;
  }

  public static formatTimerMemberPattern(name: string): string {
    return `\\b${name}\\s*\\.\\s*(?:set(?:Timeout|Interval)\\b|scheduler\\s*\\.\\s*wait\\b)`;
  }

  public static formatTimingReport(name: string, run: number): string {
    return `${name}-run-${run}.json`;
  }

  public static formatTimingSummary(slowFiles: number, slowSpecs: number): string {
    return `Timing check: ${slowFiles} unit test files over ${Resources.unitFileBudget} ms and not accepted, ${slowSpecs} spec files over a ${Resources.specMedianBudget} ms median test. Each time is the median of ${Resources.timingRuns} runs, so one run slowed by a busy machine doesn't decide it, and a time counts as over only past the bar plus ${Math.round((Resources.timingMargin - 1) * 100)}%, for the jitter of a quiet test machine; this check is apart from npm test, since its pass condition is a time.`;
  }

  public static formatToolNameInvalid(name: string, prefix: string): string {
    return `module.json's tools entry ${name} must be a snake_case name of at most 64 characters starting with ${prefix}.`;
  }

  public static formatToolPrefix(id: string): string {
    return `${id.replaceAll(Resources.moduleIdSeparator, Resources.toolNameSeparator)}${Resources.toolNameSeparator}`;
  }

  public static formatUnitFileTiming(file: string, time: number, isAccepted: boolean): string {
    return `${isAccepted ? "accepted" : "OVER"} ${file}: ${Math.round(time)} ms, over the ${Resources.unitFileBudget} ms a unit test file may take${isAccepted ? ", which README.md accepts" : "; make it faster, or have a maintainer accept it in README.md, Test files over 1 second"}.`;
  }

  public static formatVersionMissing(file: string): string {
    return `${file} has no version.`;
  }
}

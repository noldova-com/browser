/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import ts from "typescript";

import { ApiCatalog } from "../api/api-catalog.ts";
import { ApiDeclarationsMissingException } from "../api/api-declarations-missing.exception.ts";
import { ApiExample } from "../api/api-example.ts";
import { ApiNotModuleException } from "../api/api-not-module.exception.ts";
import type { ApiPackage } from "../api/api-package.ts";
import { ApiProgram } from "../api/api-program.ts";
import { ApiValue } from "../api/api-value.ts";
import { ApiException } from "../api/api.exception.ts";
import { ApiResources } from "../api/api.resources.ts";
import { Resources } from "../resources.ts";

export class ApiExampleCheck {
  private readonly root: string;
  private readonly catalog: ApiCatalog;

  public constructor(root: string) {
    this.root = root;
    this.catalog = new ApiCatalog(root);
  }

  public async runAsync(): Promise<readonly string[]> {
    return await this.catalog.inspectEachAsync(ApiResources.exampleVerdict, (apiPackage, apiPackages) => Promise.resolve(this.inspect(apiPackage, apiPackages)));
  }

  private static toPosix(file: string): string {
    return file.split(path.sep).join(path.posix.sep);
  }

  private static readExamples(source: ts.SourceFile): readonly ApiExample[] {
    const docs = new Set<ts.JSDoc>();
    const visit = (node: ts.Node): void => {
      for (const doc of ApiValue.readOwnDocs(node))
        docs.add(doc);
      ts.forEachChild(node, visit);
    };
    ts.forEachChild(source, visit);
    const examples: ApiExample[] = [];
    for (const tag of [...docs].flatMap(t => t.tags ?? []).filter(t => t.tagName.text === ApiResources.exampleTag)) {
      const start = tag.getStart(source);
      const first = source.getLineAndCharacterOfPosition(start).line + 1;
      const lines = source.text.slice(start, tag.end).split(ApiResources.lineBreakPattern).map(t => t.replace(ApiResources.docLinePrefix, ""));
      let opened: number | null = null;
      for (const [index, line] of lines.entries()) {
        if (opened === null && ApiResources.exampleFenceStart.test(line.trim()))
          opened = index + 1;
        else if (opened !== null && ApiResources.exampleFenceEnd.test(line.trim())) {
          examples.push(new ApiExample(ApiResources.formatExampleFile(ApiExampleCheck.toPosix(source.fileName), first + opened), first + opened,
            lines.slice(opened, index).join(Resources.lineFeed)));
          opened = null;
        }
      }
    }
    return examples;
  }

  private inspect(apiPackage: ApiPackage, apiPackages: readonly ApiPackage[]): readonly string[] {
    try {
      if (!existsSync(apiPackage.declarations))
        throw new ApiDeclarationsMissingException(apiPackage.declarations);
      const declarations = ApiExampleCheck.toPosix(apiPackage.declarations);
      const examples = ApiExampleCheck.readExamples(ts.createSourceFile(declarations, readFileSync(declarations, Resources.textEncoding), ts.ScriptTarget.Latest, true));
      return this.compile(apiPackage, apiPackages, examples);
    }
    catch (error) {
      return [ApiException.describe(error)];
    }
  }

  private compile(apiPackage: ApiPackage, apiPackages: readonly ApiPackage[], examples: readonly ApiExample[]): readonly string[] {
    if (examples.length === 0)
      return [];
    const options: ts.CompilerOptions = {
      ...ApiProgram.readProject(apiPackage.project).options,
      noEmit: true,
      noUnusedLocals: false,
      noUnusedParameters: false,
      types: [...(ApiProgram.readProject(apiPackage.project).options.types ?? []), ApiResources.exampleTypes],
      rootDir: this.root,
      moduleDetection: ts.ModuleDetectionKind.Force,
      paths: Object.fromEntries(apiPackages.map(t => [t.specifier, [ApiExampleCheck.toPosix(t.declarations)]]))
    };
    const sources = new Map(examples.map(t => [t.file, t]));
    const base = ts.createCompilerHost(options, true);
    const host: ts.CompilerHost = {
      ...base,
      fileExists: t => sources.has(t) || base.fileExists(t),
      readFile: t => sources.get(t)?.code ?? base.readFile(t),
      getSourceFile: (fileName, language, onError, shouldCreate) => {
        const example = sources.get(fileName);
        return example === undefined ? base.getSourceFile(fileName, language, onError, shouldCreate) : ts.createSourceFile(fileName, example.code, language);
      }
    };
    const program = ts.createProgram({ rootNames: [...sources.keys()], options, host });
    const shown = path.relative(this.root, apiPackage.declarations).split(path.sep).join(path.posix.sep);
    const problems: string[] = [...program.getOptionsDiagnostics(), ...program.getGlobalDiagnostics()].map(t => ApiProgram.describe(t));
    for (const example of examples) {
      const source = program.getSourceFile(example.file);
      if (source === undefined)
        throw new ApiNotModuleException(example.file);
      for (const diagnostic of [...program.getSyntacticDiagnostics(source), ...program.getSemanticDiagnostics(source)])
        if (diagnostic.category === ts.DiagnosticCategory.Error) {
          const line = diagnostic.start === undefined ? 0 : source.getLineAndCharacterOfPosition(diagnostic.start).line;
          problems.push(ApiResources.formatExampleProblem(shown, example.line + line, ApiProgram.describe(diagnostic)));
        }
    }
    return problems;
  }
}

const problems: readonly string[] = await new ApiExampleCheck(process.cwd()).runAsync();
for (const problem of problems)
  console.error(problem);
process.exitCode = problems.length > 0 ? 1 : 0;

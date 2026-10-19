/**
 * Build-time MCP tool catalog generator.
 *
 *   ts-morph                  — find @mcptool methods, read TSDoc + @mcpparams,
 *                               map params → positional args (pure: scanTools)
 *   ts-json-schema-generator  — params interface → JSON Schema (draft-07)
 *   (ajv compiled at runtime in the emitted module)
 *
 * Emits `src/tools/tools.generated.ts` (checked in; CI drift-guards it).
 * `scanTools` throws `CodegenError` on any convention violation; the CLI
 * wrapper turns that into a non-zero exit so the build hard-fails.
 *
 * NOT shipped at runtime: this file lives outside `src/` so `tsc` never
 * compiles it; it runs via `ts-node` in the package `build` script.
 * `scanTools`/`CodegenError` are exported for unit tests (in-memory project).
 */
import { writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { Project, type MethodDeclaration, type SourceFile, type Type } from 'ts-morph';
import { createGenerator } from 'ts-json-schema-generator';

const PKG_ROOT = join(__dirname, '..');
const TSCONFIG = join(PKG_ROOT, 'tsconfig.json');
const OUT_FILE = join(PKG_ROOT, 'src/tools/tools.generated.ts');

/** Vendor directory under src/vendors → the ehrName the factory registers. */
const VENDOR_DIR_TO_EHRNAME: Record<string, string> = {
  cerner: 'cerner',
};

/** Thrown on any @mcptool convention violation. The CLI maps it to exit 1. */
export class CodegenError extends Error {}

/**
 * A param type is "scalar" (mapped positionally) iff it is a primitive,
 * a primitive literal, `null`/`undefined`, or a union of only those (e.g.
 * `string`, `string | null`, `'a' | 'b'`). Anything object-shaped (an
 * interface, `Record<…>`, an array) is passed through whole. Uses the
 * type checker rather than the type's text so nullable/literal unions
 * classify correctly.
 */
function isScalarType(t: Type): boolean {
  if (t.isUnion()) return t.getUnionTypes().every(isScalarType);
  return (
    t.isString() ||
    t.isNumber() ||
    t.isBoolean() ||
    t.isStringLiteral() ||
    t.isNumberLiteral() ||
    t.isBooleanLiteral() ||
    t.isNull() ||
    t.isUndefined()
  );
}

export interface ScannedTool {
  ehrName: string;
  name: string;
  description: string;
  vendorMethod: string;
  /** Dispatcher argument expressions, in order, after `config`. */
  argExprs: string[];
  interfaceName: string;
  interfaceFilePath: string;
}

export interface ScanOptions {
  /** Absolute path to the `src/vendors` root (for vendor-dir derivation). */
  vendorsRoot: string;
  /** Vendor directory → ehrName. */
  vendorMap: Record<string, string>;
  /** Path the error messages are relative to (cosmetic). */
  labelRoot: string;
}

function vendorOf(sf: SourceFile, opts: ScanOptions): string {
  const rel = relative(opts.vendorsRoot, sf.getFilePath());
  const dir = rel.split(/[\\/]/)[0];
  const ehrName = opts.vendorMap[dir];
  if (!ehrName) {
    throw new CodegenError(
      `@mcptool found under unknown vendor dir "${dir}" (${sf.getFilePath()}). Add it to VENDOR_DIR_TO_EHRNAME.`,
    );
  }
  return ehrName;
}

function collectMethod(sf: SourceFile, method: MethodDeclaration, opts: ScanOptions): ScannedTool | null {
  const jsdocs = method.getJsDocs();
  if (jsdocs.length === 0) return null;
  const jsdoc = jsdocs[jsdocs.length - 1];
  const tags = jsdoc.getTags();
  if (!tags.some((t) => t.getTagName() === 'mcptool')) return null;

  const methodName = method.getName();
  const ehrName = vendorOf(sf, opts);
  const where = `${ehrName}.${methodName} (${relative(opts.labelRoot, sf.getFilePath())})`;

  const description = jsdoc.getDescription().trim();
  if (!description) {
    throw new CodegenError(`@mcptool ${where} has no TSDoc summary. The summary is the LLM-facing tool description.`);
  }

  const interfaceName = tags
    .find((t) => t.getTagName() === 'mcpparams')
    ?.getCommentText()
    ?.trim();
  if (!interfaceName) {
    throw new CodegenError(`@mcptool ${where} is missing \`@mcpparams <InterfaceName>\`.`);
  }

  // Resolve the @mcpparams interface within the SAME vendor directory as the
  // method — so a same-named params interface in another vendor can't be
  // picked up by accident.
  const vendorDir = sf.getDirectoryPath();
  const ifaceDecl = sf
    .getProject()
    .getSourceFiles()
    .filter((f) => f.getDirectoryPath() === vendorDir)
    .flatMap((f) => f.getInterfaces())
    .find((i) => i.getName() === interfaceName && i.isExported());
  if (!ifaceDecl) {
    throw new CodegenError(
      `@mcptool ${where}: @mcpparams interface "${interfaceName}" not found or not exported in ${relative(opts.labelRoot, vendorDir)}.`,
    );
  }

  // Drop the leading `config: EhrClientConfig` parameter.
  const post = method
    .getParameters()
    .filter((p, idx) => !(idx === 0 && (p.getName() === 'config' || /EhrClientConfig/.test(p.getType().getText(p)))));

  const ifaceProps = new Set(ifaceDecl.getProperties().map((p) => p.getName()));

  let argExprs: string[];
  if (post.length === 1 && !isScalarType(post[0].getType())) {
    // Single object parameter (e.g. search `params: Record<...>`): pass the
    // whole validated input through.
    argExprs = ['input'];
  } else {
    // Named scalar parameters: map each by same-named interface property.
    for (const p of post) {
      if (!ifaceProps.has(p.getName())) {
        throw new CodegenError(
          `@mcptool ${where}: parameter "${p.getName()}" has no matching property on interface "${interfaceName}". ` +
            `The @mcpparams interface property names must equal the method's post-config parameter names.`,
        );
      }
    }
    argExprs = post.map((p) => `(input as Record<string, unknown>)[${JSON.stringify(p.getName())}]`);
  }

  return {
    ehrName,
    name: `${ehrName}_${methodName}`,
    description,
    vendorMethod: methodName,
    argExprs,
    interfaceName,
    interfaceFilePath: ifaceDecl.getSourceFile().getFilePath(),
  };
}

/**
 * Pure scan — ts-morph only, no schema generation, no IO. Throws
 * `CodegenError` on any convention violation. Unit-tested with an
 * in-memory project.
 */
export function scanTools(project: Project, opts: ScanOptions): ScannedTool[] {
  const tools: ScannedTool[] = [];
  for (const sf of project.getSourceFiles('**/vendors/**/*.service.ts')) {
    for (const cls of sf.getClasses()) {
      for (const method of cls.getMethods()) {
        const meta = collectMethod(sf, method, opts);
        if (meta) tools.push(meta);
      }
    }
  }
  const seen = new Set<string>();
  for (const t of tools) {
    if (seen.has(t.name)) throw new CodegenError(`duplicate tool name "${t.name}".`);
    seen.add(t.name);
  }
  return tools;
}

// ── Schema generation + emit (IO path; not unit-tested) ─────────────────────

/** Deterministic JSON — sorted keys — so the drift guard is stable. */
function stableStringify(value: unknown, indent = 2): string {
  const sort = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sort);
    if (v && typeof v === 'object') {
      return Object.keys(v as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, k) => {
          acc[k] = sort((v as Record<string, unknown>)[k]);
          return acc;
        }, {});
    }
    return v;
  };
  return JSON.stringify(sort(value), null, indent);
}

const schemaGenCache = new Map<string, ReturnType<typeof createGenerator>>();
function generateSchema(filePath: string, type: string): Record<string, unknown> {
  let gen = schemaGenCache.get(filePath);
  if (!gen) {
    gen = createGenerator({
      path: filePath,
      tsconfig: TSCONFIG,
      type: '*',
      jsDoc: 'extended',
      topRef: false,
      expose: 'none',
      additionalProperties: false,
      skipTypeCheck: true,
    });
    schemaGenCache.set(filePath, gen);
  }
  const schema = gen.createSchema(type) as Record<string, unknown>;
  // Inline schema at root (expose:'none'/topRef:false). Drop the JSON-Schema
  // meta key + the always-empty definitions bag — MCP wants a bare schema.
  delete (schema as { $schema?: unknown }).$schema;
  const defs = (schema as { definitions?: Record<string, unknown> }).definitions;
  if (defs && Object.keys(defs).length === 0) delete (schema as { definitions?: unknown }).definitions;
  return schema;
}

function emit(tools: ScannedTool[]): string {
  const byVendor = new Map<string, ScannedTool[]>();
  for (const t of tools) {
    const list = byVendor.get(t.ehrName) ?? [];
    list.push(t);
    byVendor.set(t.ehrName, list);
  }

  const vendorBlocks = [...byVendor.keys()]
    .sort()
    .map((ehrName) => {
      const entries = byVendor
        .get(ehrName)!
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((t) => {
          const schema = generateSchema(t.interfaceFilePath, t.interfaceName);
          const schemaLit = stableStringify(schema)
            .split('\n')
            .map((l, i) => (i === 0 ? l : `      ${l}`))
            .join('\n');
          return `    mk(
      ${JSON.stringify(t.name)},
      ${JSON.stringify(t.description)},
      ${JSON.stringify(t.vendorMethod)},
      ${schemaLit},
      async (svc, config, input) =>
        (await (svc as any).${t.vendorMethod}(config, ${t.argExprs.join(', ')})).data,
    ),`;
        })
        .join('\n');
      return `  ${JSON.stringify(ehrName)}: [\n${entries}\n  ],`;
    })
    .join('\n');

  return `/**
 * AUTO-GENERATED by scripts/gen-tools.ts — DO NOT EDIT.
 * Regenerate with \`npm run gen:tools\` (runs as part of the package build).
 * Source of truth: @mcptool-tagged methods + their @mcpparams interfaces.
 */
/* eslint-disable */
import Ajv from 'ajv';
import type { ToolDescriptor } from './types';

// removeAdditional strips properties the schema doesn't allow rather than
// rejecting them — for closed (\`additionalProperties: false\`) get-tool schemas
// this mirrors the old Zod object parse (unknown keys dropped, call proceeds);
// search schemas with a string index signature keep valid extra params.
const ajv = new Ajv({ allErrors: true, strict: false, removeAdditional: true });

function mk(
  name: string,
  description: string,
  vendorMethod: string,
  jsonSchema: Record<string, unknown>,
  invoke: ToolDescriptor['invoke'],
): ToolDescriptor {
  const v = ajv.compile(jsonSchema);
  return {
    name,
    description,
    jsonSchema,
    vendorMethod,
    validate: (input: unknown) =>
      v(input) ? { ok: true } : { ok: false, errors: ajv.errorsText(v.errors) },
    invoke,
  };
}

export const allVendorTools: Record<string, ToolDescriptor[]> = {
${vendorBlocks}
};
`;
}

function main(): void {
  const project = new Project({ tsConfigFilePath: TSCONFIG });
  const opts: ScanOptions = {
    vendorsRoot: join(PKG_ROOT, 'src/vendors'),
    vendorMap: VENDOR_DIR_TO_EHRNAME,
    labelRoot: PKG_ROOT,
  };
  let tools: ScannedTool[];
  try {
    tools = scanTools(project, opts);
    if (tools.length === 0)
      throw new CodegenError('no @mcptool methods found — expected at least the Cerner read slice.');
  } catch (err) {
    const msg = err instanceof CodegenError ? err.message : String(err);

    console.error(`\n[gen-tools] FATAL: ${msg}\n`);
    process.exit(1);
  }
  writeFileSync(OUT_FILE, emit(tools), 'utf8');

  console.log(
    `[gen-tools] wrote ${relative(PKG_ROOT, OUT_FILE)} — ${tools.length} tool(s) across ` +
      `${new Set(tools.map((t) => t.ehrName)).size} vendor(s).`,
  );
}

if (require.main === module) main();

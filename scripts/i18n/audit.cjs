const fs = require("node:fs");
const path = require("node:path");
const ts = require("../../web/node_modules/typescript");
const moduleCode = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, "../../web/src/lib/i18n/translate.ts"), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const translatorModule = { exports: {} };
new Function("exports", "module", moduleCode)(translatorModule.exports, translatorModule);

const base = path.resolve(__dirname, "../../web/src");
const directory = path.join(base, "lib/i18n/locales/pt-BR");
const translated = {};
for (const file of fs.readdirSync(directory).filter((file) => file.endsWith(".json"))) {
  const catalog = JSON.parse(fs.readFileSync(path.join(directory, file), "utf8"));
  for (const [source, target] of Object.entries(catalog)) {
    if (Object.hasOwn(translated, source)) throw Error(`Duplicate source in ${file}: ${source}`);
    translated[source] = target;
  }
}
const candidates = new Map();
const attributes = new Set(["placeholder", "title", "aria-label", "alt", "label", "description"]);
const properties = new Set(["label", "title", "description"]);
function add(text, file, node, source) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!/[a-zA-Z]{2}/.test(normalized)) return;
  const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
  if (!candidates.has(normalized)) candidates.set(normalized, []);
  candidates.get(normalized).push(`${path.relative(base, file).replaceAll("\\", "/")}:${line}`);
}
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!["mock", "i18n"].includes(entry.name)) walk(file);
      continue;
    }
    if (!/\.tsx?$/.test(file)) continue;
    const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
    function visit(node) {
      if (ts.isJsxText(node)) add(node.text, file, node, source);
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        const parent = node.parent;
        const attr = ts.isJsxAttribute(parent) ? parent : ts.isJsxExpression(parent) && ts.isJsxAttribute(parent.parent) ? parent.parent : null;
        const property = ts.isPropertyAssignment(parent) && parent.initializer === node ? parent.name.getText(source) : null;
        const expression = ts.isJsxExpression(parent) ? parent : ts.isConditionalExpression(parent) && ts.isJsxExpression(parent.parent) ? parent.parent : null;
        const rendered = expression && !ts.isJsxAttribute(expression.parent);
        if (rendered || (attr && attributes.has(attr.name.getText(source))) || properties.has(property)) add(node.text, file, node, source);
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
}
walk(base);
const translate = translatorModule.exports.createTranslator(translated);
const missing = [...candidates].filter(([source]) => !Object.hasOwn(translated, source) && translate(source) === source);
const summary = {
  catalogEntries: Object.keys(translated).length,
  uiCandidates: candidates.size,
  supportedCandidates: candidates.size - missing.length,
  candidates: [...candidates].map(([source, locations]) => ({ source, locations })),
  missing: missing.map(([source, locations]) => ({ source, locations })),
};
// This is an inventory, not a screen-completion score: technical literals and
// names need review, and dynamic templates require explicit source extraction.
if (process.argv.includes("--json")) console.log(JSON.stringify(summary, null, 2));
else {
  console.log(`pt-BR: ${summary.catalogEntries} catalog entries; ${summary.supportedCandidates}/${summary.uiCandidates} supported UI candidates.`);
  console.log("Candidates include technical labels; dynamic fragments require manual review.");
  for (const { source, locations } of summary.missing.slice(0, 30)) console.log(`  ${locations[0]}: ${source}`);
}

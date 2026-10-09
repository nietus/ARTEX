const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");
const { JSDOM } = require("jsdom");

// Transpile the isolated TS modules using the project's compiler; no build output
// or test-only production exports are needed.
function load(name, requireModule = require) {
  const source = fs.readFileSync(path.join(__dirname, "../src/lib/i18n", `${name}.ts`), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const module = { exports: {} };
  new Function("exports", "require", "module", outputText)(module.exports, requireModule, module);
  return module.exports;
}

const { createTranslator } = load("translate");
const { startDomOverlay } = load("dom-overlay");
const { LOCALES, isLocale } = load("locales");
const translate = createTranslator({ Save: "Salvar", Cancel: "Cancelar", "Enter message": "Digite uma mensagem" });
const delay = () => new Promise((resolve) => setTimeout(resolve, 150));
async function until(predicate) {
  const deadline = Date.now() + 5000;
  while (!predicate()) {
    assert.ok(Date.now() < deadline, "Timed out waiting for DOM translation");
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

test("exact matching preserves whitespace, punctuation and unknown strings", () => {
  assert.equal(translate("  Save\n"), "  Salvar\n");
  assert.equal(translate("Save:"), "Salvar:");
  assert.equal(translate("Save…"), "Salvar…");
  assert.equal(translate("Save.  Cancel!"), "Salvar.  Cancelar!");
  assert.equal(translate("Enter\n  message"), "Digite uma mensagem");
  assert.equal(translate("Save this user message"), "Save this user message");
  assert.equal(translate("constructor"), "constructor");
  assert.equal(translate("toString"), "toString");
  assert.equal(createTranslator()("Save"), "Save");
});

test("explicit templates translate dynamic labels without changing IDs or counts", () => {
  const t = createTranslator({ "Rename Task #{id}": "Renomear tarefa #{id}", "Default {count}": "Padrão: {count}" });
  assert.equal(t("Rename Task #t-acme-web"), "Renomear tarefa #t-acme-web");
  assert.equal(t("Default 10"), "Padrão: 10");
  assert.equal(t("Default user text"), "Default user text");
});

test("DOM text and presentation attributes translate; user input, code and content remain intact", () => {
  const dom = new JSDOM(`<body>
    <button title="Save" aria-label="Save"> Save </button>
    <input placeholder="Enter message" value="Save">
    <textarea placeholder="Enter message">Save</textarea>
    <img alt="Save" src="Save">
    <pre><span title="Save">Save</span></pre>
    <div contenteditable="true">Save</div>
    <div data-no-i18n><span title="Save">Save</span></div>
  </body>`);
  const document = dom.window.document;
  const stop = startDomOverlay(document.body, translate);
  assert.equal(document.querySelector("button").textContent, " Salvar ");
  assert.equal(document.querySelector("button").title, "Salvar");
  assert.equal(document.querySelector("button").getAttribute("aria-label"), "Salvar");
  assert.equal(document.querySelector("input").placeholder, "Digite uma mensagem");
  assert.equal(document.querySelector("input").value, "Save");
  assert.equal(document.querySelector("textarea").placeholder, "Digite uma mensagem");
  assert.equal(document.querySelector("textarea").value, "Save");
  assert.equal(document.querySelector("img").alt, "Salvar");
  assert.equal(document.querySelector("img").getAttribute("src"), "Save");
  assert.equal(document.querySelector("pre span").title, "Save");
  assert.equal(document.querySelector("pre").textContent, "Save");
  assert.equal(document.querySelector("[contenteditable]").textContent, "Save");
  assert.equal(document.querySelector("[data-no-i18n]").textContent, "Save");
  stop();
  assert.equal(document.querySelector("button").textContent, " Save ");
  assert.equal(document.querySelector("input").placeholder, "Enter message");
  dom.window.close();
});

test("portals, streamed text and changing attributes use the new source and restore safely", async () => {
  const dom = new JSDOM('<body><button title="Save">Save</button></body>');
  const document = dom.window.document;
  const button = document.querySelector("button");
  const stop = startDomOverlay(document.body, translate);
  button.firstChild.data = "Cancel";
  button.title = "Cancel";
  const dialog = document.createElement("div");
  dialog.textContent = "Save";
  document.body.append(dialog);
  await delay();
  assert.equal(button.textContent, "Cancelar");
  assert.equal(button.title, "Cancelar");
  assert.equal(dialog.textContent, "Salvar");
  dialog.setAttribute("data-no-i18n", "");
  await delay();
  assert.equal(dialog.textContent, "Save");
  button.firstChild.data = "New unrecognized source";
  button.title = "New unrecognized title";
  stop();
  assert.equal(button.textContent, "New unrecognized source");
  assert.equal(button.title, "New unrecognized title");
  dom.window.close();
});

test("batch boundaries translate every node, including the first node after a batch", async () => {
  const dom = new JSDOM(`<body>${"<span>Save</span>".repeat(1101)}</body>`);
  const stop = startDomOverlay(dom.window.document.body, translate, 1000);
  const spans = [...dom.window.document.querySelectorAll("span")];
  await until(() => spans.every((span) => span.textContent === "Salvar"));
  assert.equal(spans.length, 1101);
  assert.ok(spans.every((span) => span.textContent === "Salvar"));
  stop();
  assert.ok(spans.every((span) => span.textContent === "Save"));
  dom.window.close();
});

test("locale transitions restore source before applying the next locale", () => {
  const dom = new JSDOM('<body><button title="Save">Save</button></body>');
  const button = dom.window.document.querySelector("button");
  const stopPt = startDomOverlay(dom.window.document.body, translate);
  assert.equal(button.textContent, "Salvar");
  stopPt();
  const stopZh = startDomOverlay(dom.window.document.body, createTranslator({ Save: "保存" }));
  assert.equal(button.textContent, "保存");
  assert.equal(button.title, "保存");
  stopZh();
  assert.equal(button.textContent, "Save");
  assert.equal(button.title, "Save");
  dom.window.close();
});

test("locale metadata is valid and date formatters read the current language lazily", () => {
  let locale = "en";
  const { createDateFormatter, getFormattingLocale } = load("format", (name) => {
    if (name === "./locales") return { LOCALES };
    if (name === "./store") return { useLocale: { getState: () => ({ locale }) } };
    throw Error(`Unexpected import: ${name}`);
  });
  assert.equal(isLocale("pt"), true);
  assert.equal(isLocale("pt-BR"), false);
  assert.equal(isLocale("constructor"), false);
  const options = { month: "long", timeZone: "UTC" };
  const formatter = createDateFormatter(options);
  const date = Date.UTC(2026, 9, 9);
  for (const code of ["en", "pt", "zh"]) {
    locale = code;
    assert.equal(getFormattingLocale(), LOCALES[code].languageTag);
    assert.equal(formatter.format(date), new Intl.DateTimeFormat(LOCALES[code].languageTag, options).format(date));
  }
});

test("persisted locale validation preserves store methods and rejects unknown values", () => {
  const { useLocale } = load("store", (name) => (name === "./locales" ? { isLocale } : require(name)));
  const current = useLocale.getState();
  const merge = useLocale.persist.getOptions().merge;
  assert.equal(merge({ locale: "pt" }, current).locale, "pt");
  assert.equal(merge({ locale: "invalid" }, current).locale, "en");
  assert.equal(merge({ locale: "constructor" }, current).locale, "en");
  assert.equal(merge(undefined, current).setLocale, current.setLocale);
});

test("domain catalogs have no conflicting keys, blank translations or placeholder loss", () => {
  const directory = path.join(__dirname, "../src/lib/i18n/locales/pt-BR");
  const merged = {};
  for (const file of fs.readdirSync(directory).filter((file) => file.endsWith(".json"))) {
    const dictionary = JSON.parse(fs.readFileSync(path.join(directory, file), "utf8"));
    for (const [source, target] of Object.entries(dictionary)) {
      assert.ok(target.trim(), `${file}: empty translation for ${source}`);
      assert.ok(!Object.hasOwn(merged, source), `${file}: duplicate key ${source}`);
      assert.deepEqual(target.match(/\{[a-zA-Z_]+\}/g), source.match(/\{[a-zA-Z_]+\}/g));
      merged[source] = target;
    }
  }
  assert.ok(Object.keys(merged).length > 1000);
});

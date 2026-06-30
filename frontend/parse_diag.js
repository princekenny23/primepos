const ts = require("typescript");
const fs = require("fs");
const path = require("path");
const file = path.join(process.cwd(), "app/dashboard/inventory/products/categories/page.tsx");
const text = fs.readFileSync(file, "utf8");
const sourceFile = ts.createSourceFile("page.tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
console.log("diagnostics", sourceFile.parseDiagnostics.length);
for (const d of sourceFile.parseDiagnostics) {
  const loc = sourceFile.getLineAndCharacterOfPosition(d.start);
  console.log(d.messageText, "line", loc.line + 1, "char", loc.character + 1);
}

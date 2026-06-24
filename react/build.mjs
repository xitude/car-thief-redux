// Bundles the React app into ONE self-contained, offline, double-clickable HTML file.
import * as esbuild from "esbuild";
import { readFileSync, writeFileSync } from "fs";

const result = await esbuild.build({
  entryPoints: ["src/index.jsx"],
  bundle: true,
  minify: true,
  write: false,
  outdir: "dist",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
});

let js = "", css = "";
for (const f of result.outputFiles) {
  if (f.path.endsWith(".js")) js = f.text;
  if (f.path.endsWith(".css")) css = f.text;
}

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Car Theft 7 Redux</title>
<style>${css}</style>
</head>
<body>
<div id="root"></div>
<script>${js}</script>
</body>
</html>`;

writeFileSync("../CarTheft7-Redux.html", html);
console.log("Built ../CarTheft7-Redux.html —", (html.length/1024).toFixed(0), "KB");

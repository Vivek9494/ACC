/**
 * Netlify drops every `node_modules` directory from a deploy, but `expo export`
 * places package assets (icon + Google fonts) under
 * dist/assets/__node_modules/.pnpm/<pkg>/node_modules/... — those requests then
 * fall through to the SPA rewrite and return index.html.
 * Moves them to dist/assets/vendor/<pkg>/... and rewrites references.
 */
const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '../dist');
const assetsDir = path.join(distDir, 'assets');
const pnpmDir = path.join(assetsDir, '__node_modules', '.pnpm');
const vendorDir = path.join(assetsDir, 'vendor');
const REF_PATTERN = /\/assets\/__node_modules\/\.pnpm\/([^/"'\s]+)\/node_modules\//g;
const TEXT_EXTENSIONS = new Set(['.js', '.html', '.json', '.css', '.map']);

function walk(dir, onFile) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, onFile);
    else onFile(full);
  }
}

if (!fs.existsSync(pnpmDir)) {
  process.exit(0);
}

for (const pkg of fs.readdirSync(pnpmDir)) {
  const source = path.join(pnpmDir, pkg, 'node_modules');
  if (!fs.existsSync(source)) continue;
  const target = path.join(vendorDir, pkg);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.renameSync(source, target);
}
fs.rmSync(path.join(assetsDir, '__node_modules'), { recursive: true, force: true });

let rewrittenFiles = 0;
walk(distDir, (file) => {
  if (!TEXT_EXTENSIONS.has(path.extname(file))) return;
  const text = fs.readFileSync(file, 'utf8');
  const next = text.replace(REF_PATTERN, '/assets/vendor/$1/');
  if (next !== text) {
    fs.writeFileSync(file, next);
    rewrittenFiles += 1;
  }
});

const leftovers = [];
walk(distDir, (file) => {
  if (file.split(path.sep).includes('node_modules')) leftovers.push(file);
});
if (leftovers.length > 0) {
  console.error(`flatten-web-assets: node_modules paths remain:\n${leftovers.join('\n')}`);
  process.exit(1);
}

console.log(`flatten-web-assets: rewrote references in ${rewrittenFiles} file(s)`);

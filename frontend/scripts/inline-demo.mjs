// Turns the browser demo build (dist-demo/) into self-contained files.
//
// The script and the stylesheet are placed inline, so the demo is one file with
// nothing next to it. Two versions are written:
//
//   plantpulse-demo.html           a complete page; open it in any browser
//   plantpulse-demo.fragment.html  the same without <html>/<head>/<body>, for
//                                  hosts that wrap the content in their own page
//
//   npm run build:demo

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist-demo');
const index = readFileSync(join(dist, 'index.html'), 'utf8');

function onlyAsset(pattern, kind) {
  const matches = [...index.matchAll(pattern)].map((match) => match[1]);
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one ${kind} in dist-demo/index.html, found ${matches.length}.`);
  }
  return readFileSync(join(dist, matches[0]), 'utf8');
}

const css = onlyAsset(/<link rel="stylesheet"[^>]*href="\/?([^"]+\.css)"/g, 'stylesheet');
const js = onlyAsset(/<script type="module"[^>]*src="\/?([^"]+\.js)"/g, 'script');

// Text inside <script> and <style> must not contain their own closing tag.
const safeJs = js.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
if (/<\/style/i.test(css)) throw new Error('The stylesheet contains "</style"; it cannot be inlined.');

const HOST_PROOF_BASE = [
  ':root{color-scheme:dark;background:#090d16}',
  'html body{background:#090d16;color:#e2e8f0;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;font-size:16px;line-height:1.5;-webkit-font-smoothing:antialiased}',
].join('');

const title = '<title>PlantPulse Live-Ops</title>';
const body = [
  `<style>${css}</style>`,
  // A host that wraps the fragment brings its own base styles for the page
  // (light scheme, its own background, a smaller font). The application sets
  // these inside a cascade layer, where any host rule outside a layer wins,
  // so they are repeated here outside every layer. The design is dark only.
  `<style>${HOST_PROOF_BASE}</style>`,
  '<div id="root"></div>',
  `<script type="module">${safeJs}</script>`,
  '',
].join('\n');
const fragment = `${title}\n${body}`;

const page = [
  '<!doctype html>',
  '<html lang="en">',
  '<head>',
  '<meta charset="UTF-8" />',
  '<meta name="viewport" content="width=device-width, initial-scale=1.0" />',
  title,
  '</head>',
  '<body>',
  body + '</body>',
  '</html>',
  '',
].join('\n');

for (const [name, text] of [
  ['plantpulse-demo.html', page],
  ['plantpulse-demo.fragment.html', fragment],
]) {
  writeFileSync(join(dist, name), text, 'utf8');
  console.log(`wrote dist-demo/${name} (${Math.round(text.length / 1024)} kB)`);
}

/**
 * Turns the walkthrough into one self-contained HTML file.
 *
 *   npm install && npm run build
 *
 * Why this exists: the markdown renders correctly in a repository browser only when the
 * browser can also fetch the images, and for a private repository those come from a
 * short-lived signed URL on a separate host. Anything between the reader and that host —
 * an extension, an ad blocker, a DNS filter, a corporate proxy — breaks every image while
 * leaving the page itself intact, which reads as a broken document and is not one.
 *
 * So the images are embedded. The output has no external reference of any kind: no image
 * host, no stylesheet, no font, no script. It opens from a download, from an email
 * attachment, from a USB stick, and from a folder with no network at all — and it prints
 * to a clean PDF, which is what a meeting usually wants.
 */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Buffer } from 'node:buffer';
import { marked } from 'marked';

const here = dirname(fileURLToPath(import.meta.url));
const SOURCE = join(here, 'admin-console-walkthrough.md');
const OUTPUT = join(here, 'admin-console-walkthrough.html');
const IMAGES = join(here, 'screens');

/**
 * The repository home page, written from the same source.
 *
 * It was a hand-made copy, which meant two byte-identical files that would answer the
 * same question differently the first time one of them was edited. Generating it costs
 * nothing and removes that.
 */
const HOME = join(here, 'README.md');

const MEDIA_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

/** Every image in the folder, as a data URI keyed by the path the markdown uses. */
async function embeddedImages() {
  const embedded = new Map();

  for (const name of await readdir(IMAGES)) {
    const type = MEDIA_TYPES[extname(name).toLowerCase()];
    if (!type) continue;

    const bytes = await readFile(join(IMAGES, name));
    // One line, no wrapping. A data URI split across lines would be broken by any
    // line-ending conversion; on a single line there is nothing for that to touch.
    embedded.set(`screens/${name}`, `data:${type};base64,${bytes.toString('base64')}`);
  }

  return embedded;
}

const images = await embeddedImages();
const markdown = await readFile(SOURCE, 'utf8');

let missing = 0;

marked.use({
  renderer: {
    image({ href, title, text }) {
      const source = images.get(href);

      if (!source) {
        // Named rather than silently rendered as a broken image, which is the whole
        // failure this file exists to remove.
        console.error(`  no image for ${href}`);
        missing += 1;
      }

      return (
        `<figure><img src="${source ?? href}" alt="${escapeAttribute(text)}"` +
        `${title ? ` title="${escapeAttribute(title)}"` : ''} />` +
        `<figcaption>${escapeHtml(text)}</figcaption></figure>`
      );
    },
  },
});

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const escapeAttribute = (value) => escapeHtml(value).replace(/"/g, '&quot;');

const body = await marked.parse(markdown, { gfm: true });

const title = (markdown.match(/^#\s+(.+)$/m)?.[1] ?? 'HAAT Operations Console').trim();

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
  :root {
    --ink: #16242a;
    --ink-soft: #55686f;
    --ink-faint: #84969c;
    --line: #dde3e5;
    --line-soft: #eceff0;
    --ground: #ffffff;
    --panel: #f7f9f9;
    --brand: #0d6d80;
    --rail: #0b2f38;
    --good: #0f6b42;
    --bad: #9e2620;
    --sans: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
    --mono: 'IBM Plex Mono', ui-monospace, Consolas, 'Courier New', monospace;
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    background: var(--ground);
    color: var(--ink);
    font: 16px/1.65 var(--sans);
    -webkit-text-size-adjust: 100%;
  }

  .sheet { max-width: 860px; margin: 0 auto; padding: 56px 28px 96px; }

  h1 {
    font-size: 2rem;
    line-height: 1.2;
    margin: 0 0 8px;
    letter-spacing: -0.01em;
  }

  h2 {
    font-size: 1.4rem;
    margin: 56px 0 16px;
    padding-bottom: 8px;
    border-bottom: 2px solid var(--rail);
    letter-spacing: -0.005em;
  }

  h3 { font-size: 1.1rem; margin: 32px 0 10px; }

  p, ul, ol { margin: 0 0 14px; }
  ul, ol { padding-left: 24px; }
  li { margin-bottom: 5px; }
  li > ul, li > ol { margin-top: 5px; }

  a { color: var(--brand); }

  strong { font-weight: 600; }

  hr {
    border: 0;
    border-top: 1px solid var(--line);
    margin: 40px 0;
  }

  code {
    font-family: var(--mono);
    font-size: 0.88em;
    background: var(--panel);
    border: 1px solid var(--line-soft);
    border-radius: 4px;
    padding: 1px 5px;
  }

  pre {
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 14px 16px;
    overflow-x: auto;
    line-height: 1.5;
  }

  pre code {
    background: none;
    border: 0;
    padding: 0;
    font-size: 0.82em;
    white-space: pre;
  }

  blockquote {
    margin: 18px 0;
    padding: 12px 18px;
    border-left: 3px solid var(--brand);
    background: var(--panel);
    color: var(--ink);
  }

  blockquote p:last-child { margin-bottom: 0; }

  table {
    width: 100%;
    border-collapse: collapse;
    margin: 0 0 18px;
    font-size: 0.94em;
  }

  th, td {
    text-align: left;
    vertical-align: top;
    padding: 9px 12px;
    border-bottom: 1px solid var(--line-soft);
  }

  th {
    background: var(--panel);
    font-weight: 600;
    border-bottom: 1px solid var(--line);
  }

  /* A screenshot is the evidence, so it gets a frame and room to breathe. */
  figure {
    margin: 22px 0 26px;
    padding: 0;
  }

  figure img {
    display: block;
    width: 100%;
    height: auto;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--panel);
  }

  figcaption {
    margin-top: 8px;
    font-size: 0.82rem;
    color: var(--ink-faint);
  }

  figcaption:empty { display: none; }

  @media print {
    /* Printed to PDF this is the handout, so nothing may be cut in half. */
    .sheet { max-width: none; padding: 0; }
    body { font-size: 10.5pt; }
    h2 { break-after: avoid; }
    h3 { break-after: avoid; }
    figure { break-inside: avoid; }
    table { break-inside: avoid; }
    pre { break-inside: avoid; white-space: pre-wrap; }
    a { color: var(--ink); text-decoration: none; }
  }
</style>
</head>
<body>
<main class="sheet">
${body}
</main>
</body>
</html>
`;

await writeFile(OUTPUT, html, 'utf8');
await writeFile(HOME, markdown, 'utf8');

const megabytes = (Buffer.byteLength(html) / (1024 * 1024)).toFixed(2);
console.log(`\n  ${images.size} image(s) embedded`);
console.log(`  ${OUTPUT}  (${megabytes} MB, self-contained)`);
console.log(`  ${HOME}  (copied from the source)\n`);

if (missing > 0) {
  console.error(`  ${missing} image reference(s) could not be resolved.\n`);
  process.exit(1);
}

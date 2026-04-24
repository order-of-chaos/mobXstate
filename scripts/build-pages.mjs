import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const distPages = path.join(repoRoot, "dist-pages");
const packageJson = JSON.parse(
  readFileSync(path.join(repoRoot, "package.json"), "utf8"),
);
const repositoryUrl = String(packageJson.repository?.url ?? "");
const repositoryMatch = repositoryUrl.match(
  /github\.com[/:]([^/]+)\/([^/.]+)(?:\.git)?$/,
);
const repositoryOwner = repositoryMatch?.[1] ?? "order-of-chaos";
const repositoryName = repositoryMatch?.[2] ?? "mobXstate";
const siteBaseUrl = `https://${repositoryOwner}.github.io/${repositoryName}`;
const canonicalDocsSource = path.join(repoRoot, "docs");
const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";

const docsPages = [
  {
    slug: "",
    title: "MobXstate Docs",
    description: "Canonical MobXstate documentation index.",
    source: path.join(canonicalDocsSource, "index.md"),
    urlPath: "/docs/",
  },
  {
    slug: "getting-started",
    title: "Getting Started",
    description: "Install MobXstate and start with the smallest working setup.",
    source: path.join(canonicalDocsSource, "getting-started.md"),
    urlPath: "/docs/getting-started/",
  },
  {
    slug: "api-reference",
    title: "API Reference",
    description: "Public MobXstate API and runtime behavior.",
    source: path.join(canonicalDocsSource, "api-reference.md"),
    urlPath: "/docs/api-reference/",
  },
  {
    slug: "examples",
    title: "Examples",
    description: "Live demo and standalone MobXstate examples.",
    source: path.join(canonicalDocsSource, "examples.md"),
    urlPath: "/docs/examples/",
  },
];

const docsNav = [
  { href: "/docs/", label: "Docs" },
  { href: "/docs/getting-started/", label: "Getting Started" },
  { href: "/docs/api-reference/", label: "API Reference" },
  { href: "/docs/examples/", label: "Examples" },
  { href: "/", label: "Live Demo" },
];

const escapeHtml = (value) => {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
};

const normalizeHref = (href) => {
  if (/^[a-z]+:/i.test(href)) {
    return href;
  }

  if (href.startsWith("/")) {
    return `${siteBaseUrl}${href}`;
  }

  return href;
};

const renderInline = (value) => {
  let html = escapeHtml(value);

  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_match, label, href) =>
      `<a href="${escapeHtml(normalizeHref(href))}">${escapeHtml(label)}</a>`,
  );
  html = html.replace(/`([^`]+)`/g, (_match, code) => `<code>${escapeHtml(code)}</code>`);
  html = html.replace(/\*\*([^*]+)\*\*/g, (_match, text) => `<strong>${escapeHtml(text)}</strong>`);

  return html;
};

const renderMarkdown = (markdown) => {
  const lines = markdown.replaceAll("\r\n", "\n").split("\n");
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith("```")) {
      const language = trimmed.slice(3).trim();
      const codeLines = [];
      index += 1;

      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }

      blocks.push(
        `<pre><code class="language-${escapeHtml(language || "text")}">${escapeHtml(
          codeLines.join("\n"),
        )}</code></pre>`,
      );
      index += 1;
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      blocks.push(`<h${level}>${renderInline(headingMatch[2])}</h${level}>`);
      index += 1;
      continue;
    }

    const unorderedMatch = trimmed.match(/^-\s+(.*)$/);
    if (unorderedMatch) {
      const items = [];

      while (index < lines.length) {
        const rawCandidate = lines[index];
        const candidate = rawCandidate.trim();
        const itemMatch = candidate.match(/^-\s+(.*)$/);
        if (!itemMatch) {
          break;
        }

        let itemText = itemMatch[1];
        index += 1;

        while (index < lines.length) {
          const continuationRaw = lines[index];
          const continuation = continuationRaw.trim();

          if (
            !continuation ||
            continuation.startsWith("#") ||
            continuation.startsWith("```") ||
            /^-\s+/.test(continuation) ||
            /^\d+\.\s+/.test(continuation) ||
            !/^\s+/.test(continuationRaw)
          ) {
            break;
          }

          itemText += ` ${continuation}`;
          index += 1;
        }

        items.push(`<li>${renderInline(itemText)}</li>`);
      }

      blocks.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    const orderedMatch = trimmed.match(/^\d+\.\s+(.*)$/);
    if (orderedMatch) {
      const items = [];

      while (index < lines.length) {
        const rawCandidate = lines[index];
        const candidate = rawCandidate.trim();
        const itemMatch = candidate.match(/^\d+\.\s+(.*)$/);
        if (!itemMatch) {
          break;
        }

        let itemText = itemMatch[1];
        index += 1;

        while (index < lines.length) {
          const continuationRaw = lines[index];
          const continuation = continuationRaw.trim();

          if (
            !continuation ||
            continuation.startsWith("#") ||
            continuation.startsWith("```") ||
            /^-\s+/.test(continuation) ||
            /^\d+\.\s+/.test(continuation) ||
            !/^\s+/.test(continuationRaw)
          ) {
            break;
          }

          itemText += ` ${continuation}`;
          index += 1;
        }

        items.push(`<li>${renderInline(itemText)}</li>`);
      }

      blocks.push(`<ol>${items.join("")}</ol>`);
      continue;
    }

    const paragraph = [];
    while (index < lines.length) {
      const candidate = lines[index].trim();
      if (
        !candidate ||
        candidate.startsWith("```") ||
        candidate.startsWith("#") ||
        candidate.startsWith("- ") ||
        /^\d+\.\s+/.test(candidate)
      ) {
        break;
      }
      paragraph.push(candidate);
      index += 1;
    }

    if (paragraph.length > 0) {
      blocks.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
    }
  }

  return blocks.join("\n");
};

const docsStyles = `:root {
  color-scheme: light;
  --bg: #f5efe3;
  --panel: #fffaf2;
  --ink: #1d160f;
  --muted: #6f6254;
  --line: #d7c7b3;
  --accent: #9b4d1f;
  --shadow: 0 18px 40px rgba(67, 39, 18, 0.12);
}

* {
  box-sizing: border-box;
}

html {
  font-family: "Georgia", "Iowan Old Style", "Times New Roman", serif;
  background: radial-gradient(circle at top, #fff8ef, var(--bg) 60%);
  color: var(--ink);
}

body {
  margin: 0;
}

a {
  color: var(--accent);
}

.shell {
  max-width: 1100px;
  margin: 0 auto;
  padding: 40px 20px 72px;
}

.hero {
  background: linear-gradient(145deg, rgba(255, 250, 242, 0.96), rgba(243, 223, 198, 0.92));
  border: 1px solid var(--line);
  border-radius: 28px;
  box-shadow: var(--shadow);
  padding: 32px;
}

.eyebrow {
  font-size: 12px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--muted);
}

.hero h1 {
  font-size: clamp(2.4rem, 5vw, 4rem);
  margin: 12px 0 10px;
}

.hero p {
  max-width: 60ch;
  font-size: 1.05rem;
  line-height: 1.7;
}

.nav {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 18px;
}

.nav a {
  text-decoration: none;
  padding: 10px 14px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.7);
}

.content {
  margin-top: 28px;
}

.card {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 24px;
  box-shadow: var(--shadow);
  padding: 28px;
}

.card h2,
.card h3 {
  margin-top: 1.4em;
}

.card h1:first-child,
.card h2:first-child,
.card h3:first-child {
  margin-top: 0;
}

.card p,
.card li {
  line-height: 1.7;
}

.card ul,
.card ol {
  padding-left: 1.4rem;
}

pre {
  overflow-x: auto;
  background: #1f1913;
  color: #f7f0e6;
  padding: 18px;
  border-radius: 18px;
}

code {
  font-family: "SFMono-Regular", "Menlo", "Consolas", monospace;
}

.footer {
  margin-top: 28px;
  color: var(--muted);
  font-size: 0.95rem;
}`;

const renderPage = ({ title, description, urlPath, bodyHtml }) => {
  const fullTitle = title === "MobXstate Docs" ? title : `${title} | MobXstate Docs`;
  const canonicalUrl = `${siteBaseUrl}${urlPath}`;
  const navHtml = docsNav
    .map((item) => `<a href="${escapeHtml(normalizeHref(item.href))}">${escapeHtml(item.label)}</a>`)
    .join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(fullTitle)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta property="og:title" content="${escapeHtml(fullTitle)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    <style>${docsStyles}</style>
  </head>
  <body>
    <div class="shell">
      <header class="hero">
        <div class="eyebrow">MobXstate</div>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(description)}</p>
        <nav class="nav" aria-label="Docs navigation">${navHtml}</nav>
      </header>
      <main class="content">
        <article class="card">
${bodyHtml}
        </article>
      </main>
      <footer class="footer">
        Canonical docs source lives in <code>docs/</code>. Public demo:
        <a href="${siteBaseUrl}/">home page</a>.
      </footer>
    </div>
  </body>
</html>
`;
};

const runVitePagesBuild = () => {
  const result = spawnSync(
    npxCommand,
    ["--no-install", "vite", "build", "--config", "vite.pages.config.ts"],
    {
      cwd: repoRoot,
      stdio: "inherit",
      env: {
        ...process.env,
        GITHUB_ACTIONS: "true",
        GITHUB_REPOSITORY: `${repositoryOwner}/${repositoryName}`,
      },
    },
  );

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

const writeDocsPages = () => {
  const docsRoot = path.join(distPages, "docs");
  mkdirSync(docsRoot, { recursive: true });

  docsPages.forEach((page) => {
    const markdown = readFileSync(page.source, "utf8");
    const bodyHtml = renderMarkdown(markdown)
      .split("\n")
      .map((line) => `          ${line}`)
      .join("\n");
    const pageDirectory = page.slug ? path.join(docsRoot, page.slug) : docsRoot;

    mkdirSync(pageDirectory, { recursive: true });
    writeFileSync(
      path.join(pageDirectory, "index.html"),
      renderPage({
        title: page.title,
        description: page.description,
        urlPath: page.urlPath,
        bodyHtml,
      }),
    );
  });
};

const writeRobots = () => {
  writeFileSync(
    path.join(distPages, "robots.txt"),
    `User-agent: *\nAllow: /\nSitemap: ${siteBaseUrl}/sitemap.xml\n`,
  );
};

const writeSitemap = () => {
  const urls = ["/", ...docsPages.map((page) => page.urlPath)];
  const body = urls
    .map((urlPath) => `  <url><loc>${escapeHtml(`${siteBaseUrl}${urlPath}`)}</loc></url>`)
    .join("\n");

  writeFileSync(
    path.join(distPages, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`,
  );
};

const writeHomeMetadata = () => {
  const homePath = path.join(distPages, "index.html");
  const html = readFileSync(homePath, "utf8");
  const metadata = [
    `<meta name="description" content="MobXstate brings statechart-shaped finite state machines to MobX stores." />`,
    `<meta property="og:title" content="MobXstate" />`,
    `<meta property="og:description" content="Statechart-shaped finite state machines for MobX stores." />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:url" content="${siteBaseUrl}/" />`,
    `<link rel="canonical" href="${siteBaseUrl}/" />`,
  ].join("\n    ");

  writeFileSync(homePath, html.replace("</head>", `    ${metadata}\n  </head>`));
};

runVitePagesBuild();
writeDocsPages();
writeRobots();
writeSitemap();
writeHomeMetadata();

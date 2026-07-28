#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const CLEAN_CONTENT_REGEX = {
  comments: /\/\*[\s\S]*?\*\/|\/\/.*$/gm,
  templateLiterals: /`[\s\S]*?`/g,
  strings: /'[^']*'|"[^"]*"/g,
  jsxExpressions: /\{.*?\}/g,
  htmlEntities: {
    quot: /&quot;/g,
    amp: /&amp;/g,
    lt: /&lt;/g,
    gt: /&gt;/g,
    apos: /&apos;/g
  }
};

const EXTRACTION_REGEX = {
  // Matches a Route's path + element component name directly, regardless of
  // whitespace/newlines between attributes. A generic "<Route ...>" capture
  // followed by separate path/element regexes doesn't work here because
  // element={<Component />} contains a "/>" that prematurely closes a
  // "[^>]*>" match before it reaches the Route tag's own closing "/>".
  routeWithElement: /<Route\s+path=["']([^"']+)["'][\s\S]*?element=\{<(\w+)/g,
  helmet: /<Helmet[^>]*?>([\s\S]*?)<\/Helmet>/i,
  helmetTest: /<Helmet[\s\S]*?<\/Helmet>/i,
  title: /<title[^>]*?>\s*(.*?)\s*<\/title>/i,
  description: /<meta\s+name=["']description["']\s+content=["'](.*?)["']/i,
  // PageSEO is the shared SEO component (title/description/path passed as
  // literal string props) used by pages instead of a raw <Helmet> block.
  pageSeoTest: /<PageSEO\b[\s\S]*?\/?>/i,
  pageSeoTag: /<PageSEO\b([\s\S]*?)\/?>/i,
  pageSeoTitle: /\btitle=["']([^"']+)["']/i,
  pageSeoDescription: /\bdescription=["']([^"']+)["']/i
};

function cleanContent(content) {
  return content
    .replace(CLEAN_CONTENT_REGEX.comments, '')
    .replace(CLEAN_CONTENT_REGEX.templateLiterals, '""')
    .replace(CLEAN_CONTENT_REGEX.strings, '""');
}

function cleanText(text) {
  if (!text) return text;
  
  return text
    .replace(CLEAN_CONTENT_REGEX.jsxExpressions, '')
    .replace(CLEAN_CONTENT_REGEX.htmlEntities.quot, '"')
    .replace(CLEAN_CONTENT_REGEX.htmlEntities.amp, '&')
    .replace(CLEAN_CONTENT_REGEX.htmlEntities.lt, '<')
    .replace(CLEAN_CONTENT_REGEX.htmlEntities.gt, '>')
    .replace(CLEAN_CONTENT_REGEX.htmlEntities.apos, "'")
    .trim();
}

function extractRoutes(appJsxPath) {
  if (!fs.existsSync(appJsxPath)) return new Map();

  try {
    const content = fs.readFileSync(appJsxPath, 'utf8');
    const routes = new Map();
    const routeMatches = [...content.matchAll(EXTRACTION_REGEX.routeWithElement)];

    for (const [, routePath, componentName] of routeMatches) {
      // First Route wins if a component is reused across paths/redirects.
      if (!routes.has(componentName)) {
        routes.set(componentName, routePath.startsWith('/') ? routePath : `/${routePath}`);
      }
    }

    return routes;
  } catch (error) {
    return new Map();
  }
}

function findReactFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findReactFiles(fullPath));
    } else if (/\.jsx?$/.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

function extractPageSeoData(content, filePath, routes) {
  if (!EXTRACTION_REGEX.pageSeoTest.test(content)) return null;

  const tagMatch = content.match(EXTRACTION_REGEX.pageSeoTag);
  if (!tagMatch) return null;

  const propsSource = tagMatch[1];
  const title = cleanText(propsSource.match(EXTRACTION_REGEX.pageSeoTitle)?.[1]);
  const description = cleanText(propsSource.match(EXTRACTION_REGEX.pageSeoDescription)?.[1]);

  // Dynamic-route pages (e.g. title={service.metaTitle}) don't have a
  // literal title to extract — skip rather than emit a bogus entry.
  if (!title || !description) return null;

  const fileName = path.basename(filePath, path.extname(filePath));
  const url = routes.size && routes.has(fileName)
    ? routes.get(fileName)
    : generateFallbackUrl(fileName);

  return { url, title, description };
}

function extractHelmetData(content, filePath, routes) {
  const cleanedContent = cleanContent(content);

  if (!EXTRACTION_REGEX.helmetTest.test(cleanedContent)) {
    return extractPageSeoData(content, filePath, routes);
  }

  const helmetMatch = content.match(EXTRACTION_REGEX.helmet);
  if (!helmetMatch) return null;

  const helmetContent = helmetMatch[1];
  const titleMatch = helmetContent.match(EXTRACTION_REGEX.title);
  const descMatch = helmetContent.match(EXTRACTION_REGEX.description);

  const title = cleanText(titleMatch?.[1]);
  const description = cleanText(descMatch?.[1]);

  const fileName = path.basename(filePath, path.extname(filePath));
  const url = routes.size && routes.has(fileName)
    ? routes.get(fileName)
    : generateFallbackUrl(fileName);

  return {
    url,
    title: title || 'Untitled Page',
    description: description || 'No description available'
  };
}

function generateFallbackUrl(fileName) {
  const cleanName = fileName.replace(/Page$/, '').toLowerCase();
  return cleanName === 'app' ? '/' : `/${cleanName}`;
}

function generateLlmsTxt(pages) {
  const sortedPages = pages.sort((a, b) => a.title.localeCompare(b.title));
  const pageEntries = sortedPages.map(page => 
    `- [${page.title}](${page.url}): ${page.description}`
  ).join('\n');
  
  return `## Pages\n${pageEntries}`;
}

function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function processPageFile(filePath, routes) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return extractHelmetData(content, filePath, routes);
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    return null;
  }
}

function main() {
  const pagesDir = path.join(process.cwd(), 'src', 'pages');
  const appJsxPath = path.join(process.cwd(), 'src', 'App.jsx');

  let pages = [];
  
  if (!fs.existsSync(pagesDir)) {
    pages.push(processPageFile(appJsxPath, []))
    pages = pages.filter(Boolean);
  } else {
    const routes = extractRoutes(appJsxPath);
    const reactFiles = findReactFiles(pagesDir);

    pages = reactFiles
      .map(filePath => processPageFile(filePath, routes))
      .filter(Boolean);
  }

  if (pages.length === 0) {
    console.error('❌ No pages with Helmet components found!');
    process.exit(1);
  }


  const llmsTxtContent = generateLlmsTxt(pages);
  const outputPath = path.join(process.cwd(), 'public', 'llms.txt');
  
  ensureDirectoryExists(path.dirname(outputPath));
  fs.writeFileSync(outputPath, llmsTxtContent, 'utf8');
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  main();
}

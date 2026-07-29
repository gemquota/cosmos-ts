// MyKB — Markdown utilities: frontmatter extraction, wiki-links, and HTML rendering

import type { Frontmatter } from '@cosmos/core';

/**
 * Extract YAML frontmatter from markdown text.
 * Matches the pattern: optional whitespace, then ---\n...\n--- or ...\n...
 */
export function extractFrontmatter(text: string): Frontmatter {
  const result: Frontmatter = { tags: [] };
  const fmMatch = text.match(/^\s*---\s*\n([\s\S]*?)\n(?:---|\.\.\.)/);
  if (!fmMatch) return result;

  const fm = fmMatch[1];

  const titleMatch = fm.match(/^title:\s*"([^"]+)"/m);
  if (titleMatch) result.title = titleMatch[1];

  const typeMatch = fm.match(/^type:\s*"([^"]+)"/m);
  if (typeMatch) result.type = typeMatch[1];

  const tagsMatch = fm.match(/^tags:\s*\[(.*?)\]/s);
  if (tagsMatch) {
    const parsed = tagsMatch[1].match(/"([^"]+)"/g);
    if (parsed) {
      result.tags = parsed.map((t) => t.replace(/"/g, ''));
    }
  }

  return result;
}

/**
 * Strip frontmatter from markdown text, returning the body only.
 */
export function stripFrontmatter(text: string): string {
  return text.replace(/^\s*---[\s\S]*?\n(?:---|\.\.\.)\s*\n?/, '').trim();
}

/**
 * Convert wiki-style links [[Page Name]] to HTML anchor tags.
 */
export function renderWikiLinks(text: string): string {
  return text.replace(/\[\[([^\]]+)\]\]/g, (_, name: string) => {
    const href = name.replace(/\s+/g, '-').toLowerCase();
    return `<a href="/wiki/${href}" class="wiki-link" data-page="${name}">${name}</a>`;
  });
}

/**
 * Convert markdown code fences to HTML with optional language class.
 */
function renderCodeBlock(language: string, code: string): string {
  const langClass = language ? ` class="language-${language}"` : '';
  return `<pre><code${langClass}>${escapeHtml(code)}</code></pre>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Simple markdown-to-HTML renderer.
 * Supports: headers, bold, italic, code blocks, inline code, links, lists, paragraphs.
 */
export function markdownToHtml(text: string): string {
  const lines = text.split('\n');
  const html: string[] = [];
  let inCodeBlock = false;
  let codeLang = '';
  let codeLines: string[] = [];
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code block fence
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        html.push(renderCodeBlock(codeLang, codeLines.join('\n')));
        codeLines = [];
        inCodeBlock = false;
        codeLang = '';
      } else {
        inCodeBlock = true;
        codeLang = line.slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    const trimmed = line.trim();

    // Close list if needed
    if (inList && !trimmed.startsWith('- ') && !trimmed.startsWith('* ')) {
      html.push('</ul>');
      inList = false;
    }

    // Empty line
    if (trimmed === '') {
      if (inList) {
        html.push('</ul>');
        inList = false;
      }
      continue;
    }

    // Header
    const headerMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const content = renderInline(headerMatch[2]);
      html.push(`<h${level}>${content}</h${level}>`);
      continue;
    }

    // List item
    const listMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (listMatch) {
      if (!inList) {
        html.push('<ul>');
        inList = true;
      }
      html.push(`<li>${renderInline(listMatch[1])}</li>`);
      continue;
    }

    // Regular paragraph
    html.push(`<p>${renderInline(trimmed)}</p>`);
  }

  // Close any open blocks
  if (inCodeBlock) {
    html.push(renderCodeBlock(codeLang, codeLines.join('\n')));
  }
  if (inList) {
    html.push('</ul>');
  }

  return html.join('\n');
}

/**
 * Inline rendering: bold, italic, code, links, wiki-links.
 */
function renderInline(text: string): string {
  let result = text;

  // Images ![alt](url)
  result = result.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');

  // Links [text](url)
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Wiki links [[Page Name]]
  result = renderWikiLinks(result);

  // Bold **text**
  result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Italic *text* (but not **)
  result = result.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Inline code `code`
  result = result.replace(/`([^`]+)`/g, '<code>$1</code>');

  return result;
}

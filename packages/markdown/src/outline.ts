export interface OutlineEntry {
  readonly id: string;
  readonly level: number;
  readonly text: string;
  readonly line: number;
}

export interface MarkdownStats {
  readonly characters: number;
  readonly words: number;
  readonly lines: number;
}

export function extractOutline(markdown: string): OutlineEntry[] {
  const lines = markdown.split(/\r?\n/);
  const headings: OutlineEntry[] = [];
  const slugCounts = new Map<string, number>();
  let fence: string | undefined;

  lines.forEach((line, index) => {
    const fenceMarker = readFenceMarker(line);

    if (fenceMarker) {
      fence = fence ? undefined : fenceMarker;
      return;
    }

    if (fence) {
      return;
    }

    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line);

    if (!match) {
      return;
    }

    const marker = match[1];
    const rawText = match[2];

    if (!marker || !rawText) {
      return;
    }

    const text = rawText.replace(/\s+#+\s*$/, "").trim();

    if (!text) {
      return;
    }

    const baseSlug = slugify(text);
    const count = slugCounts.get(baseSlug) ?? 0;
    slugCounts.set(baseSlug, count + 1);

    headings.push({
      id: count === 0 ? baseSlug : `${baseSlug}-${count + 1}`,
      level: marker.length,
      text,
      line: index + 1
    });
  });

  return headings;
}

export function calculateMarkdownStats(markdown: string): MarkdownStats {
  const normalized = markdown.trim();
  const text = normalized
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[[^\]]+]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = text ? text.split(/\s+/).length : 0;

  return {
    characters: normalized.length,
    words,
    lines: markdown.length ? markdown.split(/\r?\n/).length : 0
  };
}

function readFenceMarker(line: string): string | undefined {
  const match = /^\s*(`{3,}|~{3,})/.exec(line);
  return match?.[1];
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "heading";
}

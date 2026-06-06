import { RangeSetBuilder } from "@codemirror/state";
import type { Extension } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";

export interface MarkdownEditorConfiguration {
  readonly fontSize: number;
  readonly lineHeight: number;
  readonly maxWidth: number;
  readonly focusMode: boolean;
  readonly typewriterMode: boolean;
}

export interface MarkdownSyntaxMarkerRange {
  readonly from: number;
  readonly to: number;
}

const syntaxMarkerDecoration = Decoration.mark({ class: "tp-editor-markdown-marker" });

export function livePreviewExtension(configuration: MarkdownEditorConfiguration): Extension {
  return [
    markdownEditorTheme(configuration),
    ViewPlugin.fromClass(
      class {
        decorations: DecorationSet;

        constructor(view: EditorView) {
          this.decorations = buildDecorations(view, configuration);
        }

        update(update: ViewUpdate): void {
          if (update.docChanged || update.viewportChanged || update.selectionSet) {
            this.decorations = buildDecorations(update.view, configuration);
          }
        }
      },
      {
        decorations: (plugin) => plugin.decorations
      }
    )
  ];
}

export function classifyMarkdownLine(text: string, active: boolean, focusMode: boolean): string[] {
  const classes = ["tp-editor-line"];

  const heading = /^(#{1,6})\s+/.exec(text);
  if (heading?.[1]) {
    classes.push("tp-editor-heading", `tp-editor-heading-${heading[1].length}`);
  } else if (/^\s*>/.test(text)) {
    classes.push("tp-editor-quote");
  } else if (/^\s*([-*+]|\d+\.)\s+/.test(text)) {
    classes.push("tp-editor-list");
  } else if (/^\s*(`{3,}|~{3,})/.test(text)) {
    classes.push("tp-editor-fence");
  } else if (!text.trim()) {
    classes.push("tp-editor-empty");
  }

  if (active) {
    classes.push("tp-editor-active-line");
  } else if (focusMode) {
    classes.push("tp-editor-passive-line");
  }

  return classes;
}

export function findInactiveMarkdownSyntaxMarkers(text: string, active: boolean): readonly MarkdownSyntaxMarkerRange[] {
  if (active) {
    return [];
  }

  const ranges: MarkdownSyntaxMarkerRange[] = [];
  collectBlockMarkers(text, ranges);
  collectDelimitedMarkers(text, ranges, "**");
  collectDelimitedMarkers(text, ranges, "__");
  collectLinkMarkers(text, ranges);

  return normalizeRanges(ranges);
}

function buildDecorations(view: EditorView, configuration: MarkdownEditorConfiguration): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const activeLine = view.state.doc.lineAt(view.state.selection.main.head).number;

  for (const range of view.visibleRanges) {
    let position = range.from;

    while (position <= range.to) {
      const line = view.state.doc.lineAt(position);
      const classes = classifyMarkdownLine(line.text, line.number === activeLine, configuration.focusMode);

      builder.add(line.from, line.from, Decoration.line({ class: classes.join(" ") }));
      for (const marker of findInactiveMarkdownSyntaxMarkers(line.text, line.number === activeLine)) {
        builder.add(line.from + marker.from, line.from + marker.to, syntaxMarkerDecoration);
      }

      const nextPosition = line.to + 1;
      if (nextPosition <= position) {
        break;
      }

      position = nextPosition;
    }
  }

  return builder.finish();
}

function collectBlockMarkers(text: string, ranges: MarkdownSyntaxMarkerRange[]): void {
  const heading = /^(#{1,6})(?=\s+)/.exec(text);
  if (heading?.[1]) {
    ranges.push({ from: 0, to: heading[1].length });
    return;
  }

  const quote = /^(\s*>+\s?)/.exec(text);
  if (quote?.[1]) {
    ranges.push({ from: 0, to: quote[1].length });
    return;
  }

  const list = /^(\s*)([-*+]|\d+[.)])(\s+)/.exec(text);
  if (list?.[1] !== undefined && list[2]) {
    ranges.push({ from: list[1].length, to: list[1].length + list[2].length });
    return;
  }

  const fence = /^(\s*)(`{3,}|~{3,})/.exec(text);
  if (fence?.[1] !== undefined && fence[2]) {
    ranges.push({ from: fence[1].length, to: fence[1].length + fence[2].length });
  }
}

function collectDelimitedMarkers(text: string, ranges: MarkdownSyntaxMarkerRange[], delimiter: string): void {
  let cursor = 0;

  while (cursor < text.length) {
    const start = text.indexOf(delimiter, cursor);
    if (start === -1) {
      return;
    }

    const contentStart = start + delimiter.length;
    const end = text.indexOf(delimiter, contentStart);
    if (end === -1) {
      return;
    }

    if (end > contentStart && !/\s/.test(text[contentStart] ?? "") && !/\s/.test(text[end - 1] ?? "")) {
      ranges.push({ from: start, to: contentStart });
      ranges.push({ from: end, to: end + delimiter.length });
    }

    cursor = end + delimiter.length;
  }
}

function collectLinkMarkers(text: string, ranges: MarkdownSyntaxMarkerRange[]): void {
  const expression = /!?\[[^\]\n]+\]\([^)]+\)/g;

  for (const match of text.matchAll(expression)) {
    const value = match[0];
    const start = match.index ?? 0;
    const bangLength = value.startsWith("!") ? 1 : 0;
    const closeBracket = value.indexOf("]");
    const closeParen = value.length - 1;

    if (bangLength > 0) {
      ranges.push({ from: start, to: start + 1 });
    }

    ranges.push({ from: start + bangLength, to: start + bangLength + 1 });
    ranges.push({ from: start + closeBracket, to: start + closeBracket + 1 });
    ranges.push({ from: start + closeBracket + 1, to: start + closeBracket + 2 });
    ranges.push({ from: start + closeParen, to: start + closeParen + 1 });
  }
}

function normalizeRanges(ranges: readonly MarkdownSyntaxMarkerRange[]): readonly MarkdownSyntaxMarkerRange[] {
  const normalized: MarkdownSyntaxMarkerRange[] = [];

  for (const range of [...ranges].sort((first, second) => first.from - second.from || first.to - second.to)) {
    if (range.to <= range.from) {
      continue;
    }

    const previous = normalized.at(-1);
    if (previous && range.from < previous.to) {
      continue;
    }

    normalized.push(range);
  }

  return normalized;
}

function markdownEditorTheme(configuration: MarkdownEditorConfiguration): Extension {
  const topPadding = configuration.typewriterMode ? "36vh" : "64px";

  return EditorView.theme({
    "&": {
      width: "100%",
      height: "100%",
      color: "var(--tp-color-text)",
      backgroundColor: "transparent",
      fontFamily: "var(--tp-font-editor)",
      fontSize: `${configuration.fontSize}px`,
      lineHeight: String(configuration.lineHeight)
    },
    ".cm-scroller": {
      overflow: "auto",
      fontFamily: "inherit"
    },
    ".cm-content": {
      maxWidth: `${configuration.maxWidth}px`,
      minHeight: "100%",
      margin: "0 auto",
      padding: `${topPadding} 40px 140px`,
      caretColor: "var(--tp-color-accent)"
    },
    ".cm-line": {
      padding: "0 2px",
      transition: "opacity var(--tp-motion-normal) ease, color var(--tp-motion-normal) ease"
    },
    ".cm-selectionBackground, ::selection": {
      backgroundColor: "var(--tp-color-selection) !important"
    },
    ".cm-cursor": {
      borderLeftColor: "var(--tp-color-accent)"
    },
    ".tp-editor-heading": {
      fontFamily: "var(--tp-font-ui)",
      fontWeight: "680",
      color: "var(--tp-color-text)"
    },
    ".tp-editor-heading-1": {
      fontSize: "1.9em",
      lineHeight: "1.18",
      paddingTop: "0.5em",
      paddingBottom: "0.28em"
    },
    ".tp-editor-heading-2": {
      fontSize: "1.48em",
      lineHeight: "1.28",
      paddingTop: "0.42em",
      paddingBottom: "0.2em"
    },
    ".tp-editor-heading-3": {
      fontSize: "1.2em",
      lineHeight: "1.35",
      paddingTop: "0.34em"
    },
    ".tp-editor-quote": {
      color: "var(--tp-color-text-muted)",
      borderLeft: "3px solid var(--tp-color-border-strong)",
      paddingLeft: "14px"
    },
    ".tp-editor-list": {
      color: "var(--tp-color-text)"
    },
    ".tp-editor-fence": {
      fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
      color: "var(--tp-color-accent-strong)"
    },
    ".tp-editor-markdown-marker": {
      color: "var(--tp-color-text-soft)",
      opacity: "var(--tp-opacity-markdown-marker)"
    },
    ".tp-editor-passive-line": {
      opacity: "var(--tp-opacity-passive-line)"
    },
    ".cm-activeLine": {
      backgroundColor: "transparent"
    },
    ".cm-panels": {
      backgroundColor: "var(--tp-color-surface)",
      color: "var(--tp-color-text)",
      borderColor: "var(--tp-color-border)"
    },
    ".cm-searchMatch": {
      backgroundColor: "rgba(216, 173, 77, 0.28)"
    }
  });
}

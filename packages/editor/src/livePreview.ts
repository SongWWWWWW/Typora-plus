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

export type MarkdownCodeFenceLineRole = "open" | "content" | "close";

export interface MarkdownCodeFenceLineState {
  readonly line: number;
  readonly role: MarkdownCodeFenceLineRole;
}

export type MarkdownTableLineRole = "header" | "delimiter" | "body";

export interface MarkdownTableLineState {
  readonly first: boolean;
  readonly last: boolean;
  readonly line: number;
  readonly role: MarkdownTableLineRole;
}

export interface MarkdownLineClassificationState {
  readonly codeFenceRole?: MarkdownCodeFenceLineRole;
  readonly tableState?: MarkdownTableLineState;
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

export function classifyMarkdownLine(
  text: string,
  active: boolean,
  focusMode: boolean,
  state: MarkdownLineClassificationState = {}
): string[] {
  const classes = ["tp-editor-line"];
  const { codeFenceRole, tableState } = state;

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

  if (codeFenceRole) {
    classes.push("tp-editor-code-block", `tp-editor-code-block-${codeFenceRole}`);
  }

  if (tableState) {
    classes.push("tp-editor-table-row", `tp-editor-table-${tableState.role}`);

    if (tableState.first) {
      classes.push("tp-editor-table-first");
    }

    if (tableState.last) {
      classes.push("tp-editor-table-last");
    }
  }

  if (active) {
    classes.push("tp-editor-active-line");
  } else if (focusMode) {
    classes.push("tp-editor-passive-line");
  }

  return classes;
}

export function analyzeMarkdownCodeFenceLines(lines: readonly string[]): readonly MarkdownCodeFenceLineState[] {
  const states: MarkdownCodeFenceLineState[] = [];
  let activeFence: string | undefined;

  lines.forEach((line, index) => {
    const marker = readOpeningFenceMarker(line);

    if (!activeFence) {
      if (!marker) {
        return;
      }

      activeFence = marker;
      states.push({ line: index + 1, role: "open" });
      return;
    }

    if (isClosingFence(line, activeFence)) {
      activeFence = undefined;
      states.push({ line: index + 1, role: "close" });
      return;
    }

    states.push({ line: index + 1, role: "content" });
  });

  return states;
}

export function analyzeMarkdownTableLines(lines: readonly string[]): readonly MarkdownTableLineState[] {
  const states: MarkdownTableLineState[] = [];
  let activeFence: string | undefined;
  let lineNumber = 1;

  while (lineNumber <= lines.length) {
    const text = lines[lineNumber - 1] ?? "";

    if (activeFence) {
      activeFence = nextFenceState(text, activeFence);
      lineNumber += 1;
      continue;
    }

    activeFence = nextFenceState(text, activeFence);
    if (activeFence) {
      lineNumber += 1;
      continue;
    }

    const table = readMarkdownTable(lines, lineNumber);
    if (!table) {
      lineNumber += 1;
      continue;
    }

    states.push(...table.states);
    lineNumber = table.nextLine;
  }

  return states;
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
  const codeFenceLineRoles = analyzeVisibleCodeFenceLines(view);
  const tableLineStates = analyzeVisibleTableLines(view);

  for (const range of view.visibleRanges) {
    let position = range.from;

    while (position <= range.to) {
      const line = view.state.doc.lineAt(position);
      const codeFenceRole = codeFenceLineRoles.get(line.number);
      const tableState = tableLineStates.get(line.number);
      const classes = classifyMarkdownLine(
        line.text,
        line.number === activeLine,
        configuration.focusMode,
        {
          ...(codeFenceRole ? { codeFenceRole } : {}),
          ...(tableState ? { tableState } : {})
        }
      );

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

function analyzeVisibleCodeFenceLines(view: EditorView): ReadonlyMap<number, MarkdownCodeFenceLineRole> {
  const roles = new Map<number, MarkdownCodeFenceLineRole>();
  let activeFence: string | undefined;
  let cursorLine = 1;

  for (const range of view.visibleRanges) {
    const firstLine = view.state.doc.lineAt(range.from).number;
    const lastLine = view.state.doc.lineAt(range.to).number;

    while (cursorLine < firstLine) {
      activeFence = nextFenceState(view.state.doc.line(cursorLine).text, activeFence);
      cursorLine += 1;
    }

    while (cursorLine <= lastLine) {
      const line = view.state.doc.line(cursorLine);
      const marker = readOpeningFenceMarker(line.text);

      if (!activeFence) {
        if (marker) {
          activeFence = marker;
          roles.set(cursorLine, "open");
        }
      } else if (isClosingFence(line.text, activeFence)) {
        activeFence = undefined;
        roles.set(cursorLine, "close");
      } else {
        roles.set(cursorLine, "content");
      }

      cursorLine += 1;
    }
  }

  return roles;
}

function analyzeVisibleTableLines(view: EditorView): ReadonlyMap<number, MarkdownTableLineState> {
  const states = new Map<number, MarkdownTableLineState>();
  const visibleLineRanges = view.visibleRanges.map((range) => ({
    first: view.state.doc.lineAt(range.from).number,
    last: view.state.doc.lineAt(range.to).number
  }));
  const lastVisibleLine = Math.max(...visibleLineRanges.map((range) => range.last));
  const isVisible = (lineNumber: number): boolean =>
    visibleLineRanges.some((range) => lineNumber >= range.first && lineNumber <= range.last);

  let activeFence: string | undefined;
  let lineNumber = 1;

  while (lineNumber <= lastVisibleLine) {
    const text = view.state.doc.line(lineNumber).text;

    if (activeFence) {
      activeFence = nextFenceState(text, activeFence);
      lineNumber += 1;
      continue;
    }

    activeFence = nextFenceState(text, activeFence);
    if (activeFence) {
      lineNumber += 1;
      continue;
    }

    const table = readMarkdownTableFromDocument(view, lineNumber, lastVisibleLine + 1);
    if (!table) {
      lineNumber += 1;
      continue;
    }

    for (const state of table.states) {
      if (isVisible(state.line)) {
        states.set(state.line, state);
      }
    }

    lineNumber = table.nextLine;
  }

  return states;
}

function nextFenceState(text: string, activeFence: string | undefined): string | undefined {
  const marker = readOpeningFenceMarker(text);

  if (!activeFence) {
    return marker;
  }

  return isClosingFence(text, activeFence) ? undefined : activeFence;
}

function isClosingFence(text: string, activeFence: string): boolean {
  const marker = readClosingFenceMarker(text);
  return Boolean(marker && marker[0] === activeFence[0] && marker.length >= activeFence.length);
}

function readOpeningFenceMarker(text: string): string | undefined {
  const match = /^\s{0,3}(`{3,}|~{3,})/.exec(text);
  return match?.[1];
}

function readClosingFenceMarker(text: string): string | undefined {
  const match = /^\s{0,3}(`{3,}|~{3,})\s*$/.exec(text);
  return match?.[1];
}

interface MarkdownTableReadResult {
  readonly nextLine: number;
  readonly states: readonly MarkdownTableLineState[];
}

function readMarkdownTable(lines: readonly string[], lineNumber: number): MarkdownTableReadResult | undefined {
  return readMarkdownTableFromSource({
    lineCount: lines.length,
    readLine: (currentLine) => lines[currentLine - 1] ?? "",
    startLine: lineNumber
  });
}

function readMarkdownTableFromDocument(
  view: EditorView,
  lineNumber: number,
  lookaheadLimit: number
): MarkdownTableReadResult | undefined {
  return readMarkdownTableFromSource({
    lineCount: view.state.doc.lines,
    lookaheadLimit,
    readLine: (currentLine) => view.state.doc.line(currentLine).text,
    startLine: lineNumber
  });
}

function readMarkdownTableFromSource(source: {
  readonly lineCount: number;
  readonly lookaheadLimit?: number;
  readonly readLine: (lineNumber: number) => string;
  readonly startLine: number;
}): MarkdownTableReadResult | undefined {
  if (source.startLine + 1 > source.lineCount) {
    return undefined;
  }

  const headerCells = readMarkdownTableCells(source.readLine(source.startLine));
  const delimiterCells = readMarkdownTableDelimiterCells(source.readLine(source.startLine + 1));

  if (
    !headerCells ||
    !delimiterCells ||
    headerCells.length !== delimiterCells.length ||
    !headerCells.some((cell) => cell.length > 0)
  ) {
    return undefined;
  }

  const rows: Array<Pick<MarkdownTableLineState, "line" | "role">> = [
    { line: source.startLine, role: "header" },
    { line: source.startLine + 1, role: "delimiter" }
  ];
  let nextLine = source.startLine + 2;
  let tableContinuesAfterLookahead = false;

  while (nextLine <= source.lineCount) {
    if (source.lookaheadLimit !== undefined && nextLine > source.lookaheadLimit) {
      tableContinuesAfterLookahead = isMarkdownTableBodyRow(source.readLine(nextLine), delimiterCells.length);
      break;
    }

    if (!isMarkdownTableBodyRow(source.readLine(nextLine), delimiterCells.length)) {
      break;
    }

    rows.push({ line: nextLine, role: "body" });
    nextLine += 1;
  }

  return {
    nextLine,
    states: rows.map((row, index) => ({
      ...row,
      first: index === 0,
      last: index === rows.length - 1 && !tableContinuesAfterLookahead
    }))
  };
}

function isMarkdownTableBodyRow(text: string, columnCount: number): boolean {
  const cells = readMarkdownTableCells(text);
  return Boolean(cells && cells.length === columnCount && !readMarkdownTableDelimiterCells(text));
}

function readMarkdownTableDelimiterCells(text: string): readonly string[] | undefined {
  const cells = readMarkdownTableCells(text);

  if (!cells || !cells.every((cell) => /^:?-{3,}:?$/.test(cell))) {
    return undefined;
  }

  return cells;
}

function readMarkdownTableCells(text: string): readonly string[] | undefined {
  const trimmed = text.trim();

  if (!trimmed.includes("|")) {
    return undefined;
  }

  const withoutLeadingPipe = trimmed.startsWith("|") ? trimmed.slice(1) : trimmed;
  const normalized = withoutLeadingPipe.endsWith("|") ? withoutLeadingPipe.slice(0, -1) : withoutLeadingPipe;
  const cells = normalized.split("|").map((cell) => cell.trim());

  return cells.length >= 2 ? cells : undefined;
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
    ".tp-editor-code-block": {
      fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
      backgroundColor: "var(--tp-color-code-block)",
      borderLeft: "3px solid var(--tp-color-code-block-border)",
      paddingLeft: "12px",
      paddingRight: "12px"
    },
    ".tp-editor-code-block-open": {
      borderTopLeftRadius: "var(--tp-radius-control)",
      borderTopRightRadius: "var(--tp-radius-control)",
      paddingTop: "6px"
    },
    ".tp-editor-code-block-close": {
      borderBottomLeftRadius: "var(--tp-radius-control)",
      borderBottomRightRadius: "var(--tp-radius-control)",
      paddingBottom: "6px"
    },
    ".tp-editor-code-block-content": {
      color: "var(--tp-color-text-muted)"
    },
    ".tp-editor-table-row": {
      backgroundColor: "var(--tp-color-table-row)",
      borderLeft: "3px solid var(--tp-color-table-border)",
      paddingLeft: "12px",
      paddingRight: "12px"
    },
    ".tp-editor-table-header": {
      backgroundColor: "var(--tp-color-table-header)",
      color: "var(--tp-color-text)",
      fontWeight: "650"
    },
    ".tp-editor-table-delimiter": {
      color: "var(--tp-color-text-soft)",
      fontSize: "0.92em"
    },
    ".tp-editor-table-body": {
      color: "var(--tp-color-text-muted)"
    },
    ".tp-editor-table-first": {
      borderTopLeftRadius: "var(--tp-radius-control)",
      borderTopRightRadius: "var(--tp-radius-control)",
      paddingTop: "4px"
    },
    ".tp-editor-table-last": {
      borderBottomLeftRadius: "var(--tp-radius-control)",
      borderBottomRightRadius: "var(--tp-radius-control)",
      paddingBottom: "4px"
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

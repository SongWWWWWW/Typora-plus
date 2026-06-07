import { RangeSetBuilder } from "@codemirror/state";
import type { Extension } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType
} from "@codemirror/view";
import { renderToString as renderKatexToString } from "katex";

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

export interface MarkdownInlineMathRange {
  readonly expression: string;
  readonly expressionFrom: number;
  readonly expressionTo: number;
  readonly from: number;
  readonly to: number;
}

export interface MarkdownInlineRendererRange {
  readonly from: number;
  readonly language: string;
  readonly source: string;
  readonly to: number;
  readonly value: string;
  readonly valueFrom: number;
  readonly valueTo: number;
}

export interface MarkdownTableCellSourceRange {
  readonly from: number;
  readonly to: number;
}

export type MarkdownCodeFenceLineRole = "open" | "content" | "close";

export interface MarkdownCodeFenceLineState {
  readonly line: number;
  readonly role: MarkdownCodeFenceLineRole;
}

export interface MarkdownCodeFenceBlockState {
  readonly blockEnd: number;
  readonly blockStart: number;
  readonly content: string;
  readonly info: string;
  readonly language: string;
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

export type MarkdownTableColumnAlignment = "center" | "default" | "left" | "right";

export interface MarkdownTableBlockState {
  readonly alignments: readonly MarkdownTableColumnAlignment[];
  readonly blockEnd: number;
  readonly blockStart: number;
  readonly bodyRows: readonly (readonly string[])[];
  readonly headerCells: readonly string[];
  readonly line: number;
  readonly previewLine: number;
  readonly role: MarkdownTableLineRole;
}

export interface MarkdownImageBlockState {
  readonly altText: string;
  readonly line: number;
  readonly previewable: boolean;
  readonly source: string;
  readonly sourceLabel: string;
  readonly title?: string;
}

export type MarkdownMathBlockLineRole = "open" | "content" | "close";

export interface MarkdownMathBlockState {
  readonly blockEnd: number;
  readonly blockStart: number;
  readonly expression: string;
  readonly line: number;
  readonly role: MarkdownMathBlockLineRole;
}

export type MarkdownMathRenderStatus = "empty" | "error" | "valid";

export interface MarkdownMathRenderResult {
  readonly error?: string;
  readonly html?: string;
  readonly source: string;
  readonly status: MarkdownMathRenderStatus;
}

export interface MarkdownMathBlockSourceRange {
  readonly fromColumn: number;
  readonly fromLine: number;
  readonly toColumn: number;
  readonly toLine: number;
}

export interface MarkdownLineClassificationState {
  readonly codeFence?: MarkdownCodeFenceBlockState;
  readonly codeFenceRole?: MarkdownCodeFenceLineRole;
  readonly imageBlock?: MarkdownImageBlockState;
  readonly mathBlock?: MarkdownMathBlockState;
  readonly tableBlock?: MarkdownTableBlockState;
  readonly tableState?: MarkdownTableLineState;
}

export interface MarkdownLineBlockState extends MarkdownLineClassificationState {
  readonly line: number;
}

export interface MarkdownVisibleLineRange {
  readonly first: number;
  readonly last: number;
}

export type MarkdownImageSourceResolver = (source: string) => Promise<string | undefined> | string | undefined;

export interface MarkdownCodeFenceRenderInput {
  readonly info: string;
  readonly language: string;
  readonly value: string;
}

export interface MarkdownCodeFenceRenderResult {
  readonly html: string;
  readonly label?: string;
  readonly rendererId: string;
}

export interface MarkdownCodeFenceRenderer {
  canRender?(input: MarkdownCodeFenceRenderInput): boolean;
  render(input: MarkdownCodeFenceRenderInput): Promise<MarkdownCodeFenceRenderResult | undefined> |
    MarkdownCodeFenceRenderResult |
    undefined;
}

export interface MarkdownInlineRenderInput {
  readonly language: string;
  readonly value: string;
}

export interface MarkdownInlineRenderResult {
  readonly html: string;
  readonly label?: string;
  readonly rendererId: string;
}

export interface MarkdownInlineRenderer {
  canRender?(input: MarkdownInlineRenderInput): boolean;
  render(input: MarkdownInlineRenderInput): Promise<MarkdownInlineRenderResult | undefined> |
    MarkdownInlineRenderResult |
    undefined;
}

export interface MarkdownCodeFenceSourceRange {
  readonly fromColumn: number;
  readonly fromLine: number;
  readonly toColumn: number;
  readonly toLine: number;
}

const syntaxMarkerDecoration = Decoration.mark({ class: "tp-editor-markdown-marker" });
const externalRendererEstimatedMinHeightPx = 92;
const externalRendererLineEstimatedHeightPx = 22;
const externalRendererEstimatedMaxHeightPx = 360;
const previewCopyFeedbackDurationMs = 1200;
const previewCopyButtonHeightPx = 24;
const previewCopyButtonMinWidthPx = 54;
const markdownTableMinimumColumnCount = 2;
const mathPreviewBodyMinHeightPx = 38;
const mathPreviewEstimatedHeight = 92;
const mathPreviewMinHeightPx = 66;
const mathPreviewToolbarMinHeightPx = 24;
const tablePreviewCellMaxWidthPx = 260;
const tablePreviewCellMinWidthPx = 88;
const tablePreviewHeaderEstimatedHeight = 42;
const tablePreviewRowEstimatedHeight = 34;
const tablePreviewToolbarEstimatedHeight = 36;
const tableAlignmentButtonHeightPx = 22;
const tableAlignmentButtonMinWidthPx = 28;
const tableToolButtonHeightPx = 24;
const tableToolButtonMinWidthPx = 38;

export function livePreviewExtension(
  configuration: MarkdownEditorConfiguration,
  resolveImageSource?: MarkdownImageSourceResolver,
  renderCodeFence?: MarkdownCodeFenceRenderer,
  renderInline?: MarkdownInlineRenderer
): Extension {
  return [
    markdownEditorTheme(configuration),
    ViewPlugin.fromClass(
      class {
        decorations: DecorationSet;

        constructor(view: EditorView) {
          this.decorations = buildDecorations(view, configuration, resolveImageSource, renderCodeFence, renderInline);
        }

        update(update: ViewUpdate): void {
          if (update.docChanged || update.viewportChanged || update.selectionSet) {
            this.decorations = buildDecorations(
              update.view,
              configuration,
              resolveImageSource,
              renderCodeFence,
              renderInline
            );
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
  const { codeFenceRole, imageBlock, mathBlock, tableState } = state;

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

  if (imageBlock) {
    classes.push("tp-editor-image-line");
  }

  if (mathBlock) {
    classes.push("tp-editor-math-block", `tp-editor-math-${mathBlock.role}`);
  }

  if (active) {
    classes.push("tp-editor-active-line");
  } else if (focusMode) {
    classes.push("tp-editor-passive-line");
  }

  return classes;
}

export function analyzeMarkdownCodeFenceLines(lines: readonly string[]): readonly MarkdownCodeFenceLineState[] {
  return analyzeMarkdownLineBlocks(lines).flatMap((state) =>
    state.codeFenceRole ? [{ line: state.line, role: state.codeFenceRole }] : []
  );
}

export function analyzeMarkdownImageBlocks(lines: readonly string[]): readonly MarkdownImageBlockState[] {
  return analyzeMarkdownLineBlocks(lines).flatMap((state) => state.imageBlock ? [state.imageBlock] : []);
}

export function analyzeMarkdownMathBlocks(lines: readonly string[]): readonly MarkdownMathBlockState[] {
  return analyzeMarkdownLineBlocks(lines).flatMap((state) => state.mathBlock ? [state.mathBlock] : []);
}

export function analyzeMarkdownTableLines(lines: readonly string[]): readonly MarkdownTableLineState[] {
  return analyzeMarkdownLineBlocks(lines).flatMap((state) => state.tableState ? [state.tableState] : []);
}

export function analyzeMarkdownLineBlocks(lines: readonly string[]): readonly MarkdownLineBlockState[] {
  return analyzeMarkdownLineBlocksFromSource({
    lineCount: lines.length,
    readLine: (lineNumber) => lines[lineNumber - 1] ?? ""
  });
}

export function analyzeMarkdownLineBlocksForVisibleRanges(source: {
  readonly lineCount: number;
  readonly readLine: (lineNumber: number) => string;
  readonly visibleRanges: readonly MarkdownVisibleLineRange[];
}): readonly MarkdownLineBlockState[] {
  const visibleRanges = normalizeMarkdownVisibleLineRanges(source.visibleRanges, source.lineCount);

  if (visibleRanges.length === 0) {
    return [];
  }

  const lastVisibleLine = visibleRanges[visibleRanges.length - 1]?.last ?? 0;
  const isVisible = (lineNumber: number): boolean =>
    visibleRanges.some((range) => lineNumber >= range.first && lineNumber <= range.last);

  return analyzeMarkdownLineBlocksFromSource({
    isVisible,
    lineCount: source.lineCount,
    lookaheadLimit: lastVisibleLine + 1,
    readLine: source.readLine,
    scanUntilLine: lastVisibleLine
  });
}

export function shouldReplaceInactiveCodeFenceLine(
  role: MarkdownCodeFenceLineRole,
  codeFenceIsActive: boolean
): boolean {
  return !codeFenceIsActive && role !== "content";
}

export function shouldReplaceInactiveTableLine(tableBlockIsActive: boolean): boolean {
  return !tableBlockIsActive;
}

export interface MarkdownTableColumnInsertionOptions {
  readonly columnIndex?: number;
}

export interface MarkdownTableBodyRowInsertionOptions {
  readonly rowIndex?: number;
}

export interface MarkdownTableBodyRowDeletionOptions {
  readonly rowIndex?: number;
}

export interface MarkdownTableColumnAlignmentOptions {
  readonly alignment: MarkdownTableColumnAlignment;
  readonly columnIndex: number;
}

export interface MarkdownTableColumnDeletionOptions {
  readonly columnIndex?: number;
  readonly minimumColumnCount?: number;
}

export function createMarkdownTableEmptyBodyRow(columnCount: number): string {
  return serializeMarkdownTableRow(createMarkdownTableEmptyBodyRowCells(columnCount));
}

export function createMarkdownTableWithInsertedBodyRow(
  tableBlock: MarkdownTableBlockState,
  options: MarkdownTableBodyRowInsertionOptions = {}
): readonly string[] {
  const columnCount = Math.max(1, tableBlock.headerCells.length);
  const rowIndex = clampTableBodyRowInsertionIndex(options.rowIndex ?? tableBlock.bodyRows.length, tableBlock.bodyRows.length);
  const headerCells = normalizeTableCells(tableBlock.headerCells, columnCount);
  const alignments = normalizeTableAlignments(tableBlock.alignments, columnCount);
  const bodyRows = tableBlock.bodyRows.map((row) => normalizeTableCells(row, columnCount));

  return createMarkdownTableLines(
    headerCells,
    alignments,
    insertTableArrayItem(bodyRows, rowIndex, createMarkdownTableEmptyBodyRowCells(columnCount))
  );
}

export function getNextMarkdownTableColumnAlignment(
  alignment: MarkdownTableColumnAlignment | undefined
): MarkdownTableColumnAlignment {
  if (alignment === undefined || alignment === "default") {
    return "left";
  }

  if (alignment === "left") {
    return "center";
  }

  if (alignment === "center") {
    return "right";
  }

  return "default";
}

export function createMarkdownTableWithInsertedColumn(
  tableBlock: MarkdownTableBlockState,
  options: MarkdownTableColumnInsertionOptions = {}
): readonly string[] {
  const columnCount = Math.max(1, tableBlock.headerCells.length);
  const columnIndex = clampTableColumnInsertionIndex(
    options.columnIndex ?? columnCount,
    columnCount
  );
  const headerCells = normalizeTableCells(tableBlock.headerCells, columnCount);
  const alignments = insertTableArrayItem(
    normalizeTableAlignments(tableBlock.alignments, columnCount),
    columnIndex,
    "default"
  );

  return createMarkdownTableLines(
    insertTableArrayItem(headerCells, columnIndex, ""),
    alignments,
    tableBlock.bodyRows.map((row) => insertTableArrayItem(normalizeTableCells(row, columnCount), columnIndex, ""))
  );
}

export function createMarkdownTableWithUpdatedColumnAlignment(
  tableBlock: MarkdownTableBlockState,
  options: MarkdownTableColumnAlignmentOptions
): readonly string[] {
  const columnCount = Math.max(1, tableBlock.headerCells.length);
  const columnIndex = clampTableColumnIndex(options.columnIndex, columnCount);
  const headerCells = normalizeTableCells(tableBlock.headerCells, columnCount);
  const alignments = replaceTableArrayItem(
    normalizeTableAlignments(tableBlock.alignments, columnCount),
    columnIndex,
    options.alignment
  );

  return createMarkdownTableLines(
    headerCells,
    alignments,
    tableBlock.bodyRows.map((row) => normalizeTableCells(row, columnCount))
  );
}

export function createMarkdownTableWithDeletedBodyRow(
  tableBlock: MarkdownTableBlockState,
  options: MarkdownTableBodyRowDeletionOptions = {}
): readonly string[] {
  const columnCount = Math.max(1, tableBlock.headerCells.length);
  const bodyRows = tableBlock.bodyRows.map((row) => normalizeTableCells(row, columnCount));

  if (bodyRows.length === 0) {
    return createMarkdownTableLines(
      normalizeTableCells(tableBlock.headerCells, columnCount),
      normalizeTableAlignments(tableBlock.alignments, columnCount),
      bodyRows
    );
  }

  const rowIndex = clampTableBodyRowIndex(options.rowIndex ?? bodyRows.length - 1, bodyRows.length);

  return createMarkdownTableLines(
    normalizeTableCells(tableBlock.headerCells, columnCount),
    normalizeTableAlignments(tableBlock.alignments, columnCount),
    bodyRows.filter((_, index) => index !== rowIndex)
  );
}

export function createMarkdownTableWithDeletedColumn(
  tableBlock: MarkdownTableBlockState,
  options: MarkdownTableColumnDeletionOptions = {}
): readonly string[] {
  const columnCount = Math.max(1, tableBlock.headerCells.length);
  const minimumColumnCount = Math.max(1, options.minimumColumnCount ?? markdownTableMinimumColumnCount);
  const headerCells = normalizeTableCells(tableBlock.headerCells, columnCount);
  const alignments = normalizeTableAlignments(tableBlock.alignments, columnCount);
  const bodyRows = tableBlock.bodyRows.map((row) => normalizeTableCells(row, columnCount));

  if (columnCount <= minimumColumnCount) {
    return createMarkdownTableLines(headerCells, alignments, bodyRows);
  }

  const columnIndex = clampTableColumnIndex(options.columnIndex ?? columnCount - 1, columnCount);

  return createMarkdownTableLines(
    removeTableArrayItem(headerCells, columnIndex),
    removeTableArrayItem(alignments, columnIndex),
    bodyRows.map((row) => removeTableArrayItem(row, columnIndex))
  );
}

export function findMarkdownTableCellSourceRange(
  text: string,
  columnIndex: number
): MarkdownTableCellSourceRange | undefined {
  const spans = readMarkdownTableCellSpans(text);

  if (!spans || !Number.isFinite(columnIndex)) {
    return undefined;
  }

  const span = spans[Math.trunc(columnIndex)];

  if (!span) {
    return undefined;
  }

  return trimMarkdownTableCellSourceRange(span);
}

export function shouldIgnorePreviewEventTarget(tagName: string | undefined): boolean {
  return tagName?.toLowerCase() === "button";
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

export function findInactiveMarkdownInlineMathRanges(text: string, active: boolean): readonly MarkdownInlineMathRange[] {
  if (active) {
    return [];
  }

  const codeSpanRanges = readMarkdownCodeSpanRanges(text);
  return readMarkdownInlineMathRanges(text, codeSpanRanges);
}

function readMarkdownInlineMathRanges(
  text: string,
  codeSpanRanges: readonly MarkdownSyntaxMarkerRange[]
): readonly MarkdownInlineMathRange[] {
  const ranges: MarkdownInlineMathRange[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const start = findNextInlineMathOpeningDelimiter(text, cursor, codeSpanRanges);

    if (!start) {
      return ranges;
    }

    if (!canOpenInlineMath(text, start.from, start.marker)) {
      cursor = start.to;
      continue;
    }

    let endCursor = start.to;
    let end: { readonly from: number; readonly to: number } | undefined;

    while (endCursor < text.length) {
      const candidate = findNextInlineMathClosingDelimiter(text, endCursor, start.marker, codeSpanRanges);

      if (!candidate) {
        break;
      }

      if (canCloseInlineMath(text, candidate.from, start.marker)) {
        end = candidate;
        break;
      }

      endCursor = candidate.to;
    }

    if (!end) {
      cursor = start.to;
      continue;
    }

    const rawExpression = text.slice(start.to, end.from);
    const leadingWhitespaceLength = rawExpression.match(/^\s*/)?.[0].length ?? 0;
    const trailingWhitespaceLength = rawExpression.match(/\s*$/)?.[0].length ?? 0;
    const expressionFrom = start.to + leadingWhitespaceLength;
    const expressionTo = Math.max(expressionFrom, end.from - trailingWhitespaceLength);
    const expression = text.slice(expressionFrom, expressionTo);

    if (expression) {
      ranges.push({
        expression,
        expressionFrom,
        expressionTo,
        from: start.from,
        to: end.to
      });
    }

    cursor = end.to;
  }

  return ranges;
}

export function findInactiveMarkdownInlineRendererRanges(
  text: string,
  active: boolean
): readonly MarkdownInlineRendererRange[] {
  if (active) {
    return [];
  }

  return readMarkdownCodeSpanRanges(text)
    .map((codeSpan) => readMarkdownInlineRendererRange(text, codeSpan))
    .filter((range): range is MarkdownInlineRendererRange => range !== undefined);
}

export function renderMarkdownMathExpression(
  expression: string,
  displayMode: boolean
): MarkdownMathRenderResult {
  const source = expression.trim();

  if (!source) {
    return { source, status: "empty" };
  }

  try {
    return {
      html: renderKatexToString(source, {
        displayMode,
        output: "mathml",
        throwOnError: true
      }),
      source,
      status: "valid"
    };
  } catch (error) {
    return {
      error: readMathRenderErrorMessage(error),
      source,
      status: "error"
    };
  }
}

export function findMarkdownMathBlockSourceRange(
  lines: readonly string[]
): MarkdownMathBlockSourceRange | undefined {
  const openLine = lines[0];

  if (openLine === undefined) {
    return undefined;
  }

  const singleLineMath = readSingleLineMarkdownMath(openLine);
  if (singleLineMath) {
    return {
      fromColumn: singleLineMath.fromColumn,
      fromLine: 1,
      toColumn: singleLineMath.toColumn,
      toLine: 1
    };
  }

  const openingFence = readMarkdownMathOpeningFence(openLine);

  if (!openingFence) {
    return undefined;
  }

  const closeLineIndex = lines.findIndex((line, index) => (
    index > 0 && isMarkdownMathClosingFence(line, openingFence)
  ));
  const contentStartIndex = 1;
  const contentEndIndexExclusive = closeLineIndex >= 0 ? closeLineIndex : lines.length;

  if (contentStartIndex < contentEndIndexExclusive) {
    return findMarkdownMathContentSourceRange(lines, contentStartIndex, contentEndIndexExclusive);
  }

  if (closeLineIndex >= 0) {
    return {
      fromColumn: 0,
      fromLine: closeLineIndex + 1,
      toColumn: 0,
      toLine: closeLineIndex + 1
    };
  }

  return {
    fromColumn: openLine.length,
    fromLine: 1,
    toColumn: openLine.length,
    toLine: 1
  };
}

function findMarkdownMathContentSourceRange(
  lines: readonly string[],
  contentStartIndex: number,
  contentEndIndexExclusive: number
): MarkdownMathBlockSourceRange {
  let firstContentIndex = contentStartIndex;

  while (
    firstContentIndex < contentEndIndexExclusive &&
    (lines[firstContentIndex]?.trim() ?? "") === ""
  ) {
    firstContentIndex += 1;
  }

  if (firstContentIndex >= contentEndIndexExclusive) {
    return {
      fromColumn: 0,
      fromLine: contentStartIndex + 1,
      toColumn: 0,
      toLine: contentStartIndex + 1
    };
  }

  let lastContentIndex = contentEndIndexExclusive - 1;

  while (
    lastContentIndex > firstContentIndex &&
    (lines[lastContentIndex]?.trim() ?? "") === ""
  ) {
    lastContentIndex -= 1;
  }

  const firstLine = lines[firstContentIndex] ?? "";
  const lastLine = lines[lastContentIndex] ?? "";

  return {
    fromColumn: readFirstNonWhitespaceIndex(firstLine),
    fromLine: firstContentIndex + 1,
    toColumn: readLastNonWhitespaceIndex(lastLine) + 1,
    toLine: lastContentIndex + 1
  };
}

export function findMarkdownCodeFenceSourceRange(
  lines: readonly string[]
): MarkdownCodeFenceSourceRange | undefined {
  const openingFence = readOpeningFence(lines[0] ?? "");
  if (!openingFence) {
    return undefined;
  }

  const closeLineIndex = lines.findIndex((line, index) => index > 0 && isClosingFence(line, openingFence.marker));

  if (closeLineIndex === -1) {
    if (lines.length <= 1) {
      const openerLength = lines[0]?.length ?? 0;

      return {
        fromColumn: openerLength,
        fromLine: 1,
        toColumn: openerLength,
        toLine: 1
      };
    }

    const lastContentLine = lines.at(-1) ?? "";

    return {
      fromColumn: 0,
      fromLine: 2,
      toColumn: lastContentLine.length,
      toLine: lines.length
    };
  }

  if (closeLineIndex === 1) {
    return {
      fromColumn: 0,
      fromLine: 2,
      toColumn: 0,
      toLine: 2
    };
  }

  const lastContentLine = lines[closeLineIndex - 1] ?? "";

  return {
    fromColumn: 0,
    fromLine: 2,
    toColumn: lastContentLine.length,
    toLine: closeLineIndex
  };
}

function buildDecorations(
  view: EditorView,
  configuration: MarkdownEditorConfiguration,
  resolveImageSource: MarkdownImageSourceResolver | undefined,
  renderCodeFence: MarkdownCodeFenceRenderer | undefined,
  renderInline: MarkdownInlineRenderer | undefined
): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const activeLine = view.state.doc.lineAt(view.state.selection.main.head).number;
  const lineBlockStates = analyzeVisibleMarkdownLineBlocks(view);
  const renderedExternalCodeFenceBlocks = new Set<string>();

  for (const range of view.visibleRanges) {
    let position = range.from;

    while (position <= range.to) {
      const line = view.state.doc.lineAt(position);
      const lineBlockState = lineBlockStates.get(line.number);
      const codeFence = lineBlockState?.codeFence;
      const imageBlock = lineBlockState?.imageBlock;
      const mathBlock = lineBlockState?.mathBlock;
      const tableBlock = lineBlockState?.tableBlock;
      const classes = classifyMarkdownLine(
        line.text,
        line.number === activeLine,
        configuration.focusMode,
        lineBlockState
      );

      builder.add(line.from, line.from, Decoration.line({ class: classes.join(" ") }));
      const lineIsActive = line.number === activeLine;
      const codeFenceIsActive = codeFence
        ? activeLine >= codeFence.blockStart && activeLine <= codeFence.blockEnd
        : false;
      const mathBlockIsActive = mathBlock
        ? activeLine >= mathBlock.blockStart && activeLine <= mathBlock.blockEnd
        : false;
      const tableBlockIsActive = tableBlock
        ? activeLine >= tableBlock.blockStart && activeLine <= tableBlock.blockEnd
        : false;

      if (codeFence && renderCodeFence && !codeFenceIsActive && canRenderCodeFence(renderCodeFence, codeFence)) {
        const codeFenceKey = `${codeFence.blockStart}:${codeFence.blockEnd}`;
        const shouldRenderWidget = !renderedExternalCodeFenceBlocks.has(codeFenceKey);
        renderedExternalCodeFenceBlocks.add(codeFenceKey);
        builder.add(line.from, line.to, Decoration.replace(
          shouldRenderWidget ? { widget: new MarkdownExternalCodeFenceWidget(codeFence, renderCodeFence) } : {}
        ));
      } else if (codeFence && shouldReplaceInactiveCodeFenceLine(codeFence.role, codeFenceIsActive)) {
        builder.add(line.from, line.to, Decoration.replace(
          codeFence.role === "open" ? { widget: new MarkdownCodeFenceHeaderWidget(codeFence) } : {}
        ));
      } else if (mathBlock && !mathBlockIsActive) {
        builder.add(line.from, line.to, Decoration.replace(
          mathBlock.role === "open" ? { widget: new MarkdownMathBlockWidget(mathBlock) } : {}
        ));
      } else if (tableBlock && shouldReplaceInactiveTableLine(tableBlockIsActive)) {
        builder.add(line.from, line.to, Decoration.replace(
          tableBlock.line === tableBlock.previewLine ? { widget: new MarkdownTableBlockWidget(tableBlock) } : {}
        ));
      } else if (imageBlock && !lineIsActive) {
        builder.add(line.from, line.to, Decoration.replace({
          widget: new MarkdownImageBlockWidget(imageBlock, resolveImageSource)
        }));
      } else {
        const inlineRenderer = renderInline;
        const inlineMathRanges = lineBlockState?.codeFenceRole || lineBlockState?.mathBlock || tableBlockIsActive
          ? []
          : findInactiveMarkdownInlineMathRanges(line.text, lineIsActive);
        const inlineRendererRanges = lineBlockState?.codeFenceRole || lineBlockState?.mathBlock || tableBlockIsActive
          ? []
          : findRenderableMarkdownInlineRendererRanges(line.text, lineIsActive, inlineRenderer);
        const inlineDecorations = inlineMathRanges.map((inlineMath) => ({
          decoration: Decoration.replace({
            widget: new MarkdownInlineMathWidget(
              inlineMath,
              line.from + inlineMath.from,
              line.from + inlineMath.to,
              line.from + inlineMath.expressionFrom,
              line.from + inlineMath.expressionTo
            )
          }),
          from: line.from + inlineMath.from,
          to: line.from + inlineMath.to
        }));
        const inlineRendererDecorations = inlineRenderer ? inlineRendererRanges.map((range) => ({
          decoration: Decoration.replace({
            widget: new MarkdownInlineRendererWidget(
              range,
              line.from + range.from,
              line.from + range.to,
              line.from + range.valueFrom,
              line.from + range.valueTo,
              inlineRenderer
            )
          }),
          from: line.from + range.from,
          to: line.from + range.to
        })) : [];
        const sourceLineIsActive = lineIsActive || codeFenceIsActive || tableBlockIsActive;
        const markerDecorations = findInactiveMarkdownSyntaxMarkers(line.text, sourceLineIsActive)
          .filter((marker) =>
            !inlineMathRanges.some((inlineMath) => rangesOverlap(marker, inlineMath)) &&
            !inlineRendererRanges.some((inlineRenderer) => rangesOverlap(marker, inlineRenderer))
          )
          .map((marker) => ({
            decoration: syntaxMarkerDecoration,
            from: line.from + marker.from,
            to: line.from + marker.to
          }));

        for (const decoration of [
          ...markerDecorations,
          ...inlineDecorations,
          ...inlineRendererDecorations
        ].sort(compareLineDecorations)) {
          builder.add(decoration.from, decoration.to, decoration.decoration);
        }
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

function compareLineDecorations(
  first: { readonly from: number; readonly to: number },
  second: { readonly from: number; readonly to: number }
): number {
  return first.from - second.from || first.to - second.to;
}

function analyzeVisibleMarkdownLineBlocks(view: EditorView): ReadonlyMap<number, MarkdownLineBlockState> {
  const visibleRanges = view.visibleRanges.map((range) => ({
    first: view.state.doc.lineAt(range.from).number,
    last: view.state.doc.lineAt(range.to).number
  }));

  return new Map(analyzeMarkdownLineBlocksForVisibleRanges({
    lineCount: view.state.doc.lines,
    readLine: (lineNumber) => view.state.doc.line(lineNumber).text,
    visibleRanges
  }).map((state) => [state.line, state]));
}

function normalizeMarkdownVisibleLineRanges(
  visibleRanges: readonly MarkdownVisibleLineRange[],
  lineCount: number
): readonly MarkdownVisibleLineRange[] {
  if (lineCount <= 0) {
    return [];
  }

  const normalized: MarkdownVisibleLineRange[] = [];

  for (const range of visibleRanges
    .map((candidate) => ({
      first: Math.max(1, Math.min(candidate.first, lineCount)),
      last: Math.max(1, Math.min(candidate.last, lineCount))
    }))
    .filter((candidate) => candidate.last >= candidate.first)
    .sort((first, second) => first.first - second.first || first.last - second.last)
  ) {
    const previous = normalized.at(-1);
    if (previous && range.first <= previous.last + 1) {
      normalized[normalized.length - 1] = {
        first: previous.first,
        last: Math.max(previous.last, range.last)
      };
      continue;
    }

    normalized.push(range);
  }

  return normalized;
}

function analyzeMarkdownLineBlocksFromSource(source: {
  readonly isVisible?: (lineNumber: number) => boolean;
  readonly lineCount: number;
  readonly lookaheadLimit?: number;
  readonly readLine: (lineNumber: number) => string;
  readonly scanUntilLine?: number;
}): readonly MarkdownLineBlockState[] {
  const states = new Map<number, MarkdownLineBlockState>();
  const scanUntilLine = Math.min(source.scanUntilLine ?? source.lineCount, source.lineCount);
  const setLineState = (line: number, state: Omit<MarkdownLineClassificationState, "line">) => {
    if (source.isVisible && !source.isVisible(line)) {
      return;
    }

    states.set(line, {
      ...states.get(line),
      line,
      ...state
    });
  };

  let lineNumber = 1;

  while (lineNumber <= scanUntilLine) {
    const text = source.readLine(lineNumber);

    const codeFence = readMarkdownCodeFenceBlockFromSource({
      ...(source.isVisible === undefined ? {} : { isVisible: source.isVisible }),
      lineCount: source.lineCount,
      readLine: source.readLine,
      startLine: lineNumber
    });
    if (codeFence) {
      for (const codeFenceState of codeFence.states) {
        setLineState(codeFenceState.line, {
          codeFence: codeFenceState,
          codeFenceRole: codeFenceState.role
        });
      }

      lineNumber = codeFence.nextLine;
      continue;
    }

    const mathBlock = readMarkdownMathBlockFromSource({
      lineCount: source.lineCount,
      readLine: source.readLine,
      startLine: lineNumber
    });
    if (mathBlock) {
      for (const mathState of mathBlock.states) {
        setLineState(mathState.line, { mathBlock: mathState });
      }

      lineNumber = mathBlock.nextLine;
      continue;
    }

    const table = readMarkdownTableFromSource({
      ...(source.isVisible === undefined ? {} : { isVisible: source.isVisible }),
      lineCount: source.lineCount,
      readLine: source.readLine,
      startLine: lineNumber,
      ...(source.lookaheadLimit === undefined ? {} : { lookaheadLimit: source.lookaheadLimit })
    });
    if (table) {
      for (const tableState of table.states) {
        setLineState(tableState.tableLine.line, {
          tableBlock: tableState.tableBlock,
          tableState: tableState.tableLine
        });
      }

      lineNumber = table.nextLine;
      continue;
    }

    const imageBlock = readMarkdownImageBlock(text, lineNumber);
    if (imageBlock) {
      setLineState(lineNumber, { imageBlock });
    }

    lineNumber += 1;
  }

  return Array.from(states.values()).sort((first, second) => first.line - second.line);
}

interface MarkdownCodeFenceReadResult {
  readonly nextLine: number;
  readonly states: readonly MarkdownCodeFenceBlockState[];
}

function readMarkdownCodeFenceBlockFromSource(source: {
  readonly isVisible?: (lineNumber: number) => boolean;
  readonly lineCount: number;
  readonly readLine: (lineNumber: number) => string;
  readonly startLine: number;
}): MarkdownCodeFenceReadResult | undefined {
  const openingFence = readOpeningFence(source.readLine(source.startLine));
  if (!openingFence) {
    return undefined;
  }

  const contentLines: string[] = [];
  let closeLine: number | undefined;
  let nextLine = source.startLine + 1;

  while (nextLine <= source.lineCount) {
    const text = source.readLine(nextLine);

    if (isClosingFence(text, openingFence.marker)) {
      closeLine = nextLine;
      break;
    }

    contentLines.push(text);
    nextLine += 1;
  }

  const blockEnd = closeLine ?? source.lineCount;
  const content = contentLines.join("\n");
  const states: MarkdownCodeFenceBlockState[] = [];
  const pushState = (line: number, role: MarkdownCodeFenceLineRole): void => {
    if (source.isVisible && !source.isVisible(line)) {
      return;
    }

    states.push({
      blockEnd,
      blockStart: source.startLine,
      content,
      info: openingFence.info,
      language: openingFence.language,
      line,
      role
    });
  };

  pushState(source.startLine, "open");
  const contentEndExclusive = closeLine ?? source.lineCount + 1;

  for (let line = source.startLine + 1; line < contentEndExclusive; line += 1) {
    pushState(line, "content");
  }

  if (closeLine !== undefined) {
    pushState(closeLine, "close");
  }

  return {
    nextLine: (closeLine ?? source.lineCount) + 1,
    states
  };
}

function isClosingFence(text: string, activeFence: string): boolean {
  const marker = readClosingFenceMarker(text);
  return Boolean(marker && marker[0] === activeFence[0] && marker.length >= activeFence.length);
}

function readOpeningFence(text: string): {
  readonly info: string;
  readonly language: string;
  readonly marker: string;
} | undefined {
  const match = /^\s{0,3}(`{3,}|~{3,})(.*)$/.exec(text);
  if (!match?.[1]) {
    return undefined;
  }

  const info = (match[2] ?? "").trim();
  return {
    info,
    language: readCodeFenceLanguage(info),
    marker: match[1]
  };
}

function readClosingFenceMarker(text: string): string | undefined {
  const match = /^\s{0,3}(`{3,}|~{3,})\s*$/.exec(text);
  return match?.[1];
}

function readCodeFenceLanguage(info: string): string {
  const token = info.trim().split(/\s+/, 1)[0] ?? "";

  return token
    .replace(/^\{\.?/, "")
    .replace(/\}$/, "")
    .trim();
}

function readMarkdownImageBlock(text: string, line: number): MarkdownImageBlockState | undefined {
  const trimmed = text.trim();
  const match = /^!\[((?:\\.|[^\]\\])*)]\((.*)\)$/.exec(trimmed);

  if (!match?.[2]) {
    return undefined;
  }

  const target = readMarkdownImageTarget(match[2]);
  if (!target) {
    return undefined;
  }

  return {
    altText: unescapeMarkdownText(match[1] ?? ""),
    line,
    previewable: isPreviewableImageSource(target.source),
    source: target.source,
    sourceLabel: imageSourceLabel(target.source),
    ...(target.title ? { title: target.title } : {})
  };
}

function readMarkdownImageTarget(value: string): { readonly source: string; readonly title?: string } | undefined {
  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  const source = readMarkdownImageSource(trimmed);
  if (!source) {
    return undefined;
  }

  const title = source.rest ? readMarkdownImageTitle(source.rest) : undefined;
  if (source.rest && title === undefined) {
    return undefined;
  }

  return {
    source: source.value,
    ...(title !== undefined ? { title } : {})
  };
}

function readMarkdownImageSource(value: string): { readonly rest: string; readonly value: string } | undefined {
  if (value.startsWith("<")) {
    const closingIndex = value.indexOf(">");
    const source = closingIndex > 0 ? value.slice(1, closingIndex).trim() : "";
    return source ? { rest: value.slice(closingIndex + 1).trim(), value: source } : undefined;
  }

  const match = /^(\S+)(.*)$/.exec(value);
  const source = match?.[1]?.trim();
  return source ? { rest: match?.[2]?.trim() ?? "", value: source } : undefined;
}

function readMarkdownImageTitle(value: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const match = /^(?:"([^"]*)"|'([^']*)'|\(([^)]*)\))$/.exec(value.trim());
  return match ? unescapeMarkdownText(match[1] ?? match[2] ?? match[3] ?? "") : undefined;
}

function isPreviewableImageSource(source: string): boolean {
  return /^data:image\/[a-z0-9.+-]+[;,]/i.test(source) || /^blob:/i.test(source);
}

function imageSourceLabel(source: string): string {
  if (/^data:image\//i.test(source)) {
    return "inline image";
  }

  if (/^blob:/i.test(source)) {
    return "browser image";
  }

  const cleanSource = source.split(/[?#]/, 1)[0] ?? source;
  const candidate = cleanSource.split(/[\\/]/).filter(Boolean).at(-1) ?? source;

  try {
    return decodeURIComponent(candidate);
  } catch {
    return candidate;
  }
}

function unescapeMarkdownText(text: string): string {
  return text.replace(/\\([\\[\]()'"<>])/g, "$1");
}

interface MarkdownMathReadResult {
  readonly nextLine: number;
  readonly states: readonly MarkdownMathBlockState[];
}

interface MarkdownMathFence {
  readonly closeMarker: string;
  readonly openMarker: string;
}

function readMarkdownMathBlockFromSource(source: {
  readonly lineCount: number;
  readonly readLine: (lineNumber: number) => string;
  readonly startLine: number;
}): MarkdownMathReadResult | undefined {
  const startText = source.readLine(source.startLine);
  const singleLineMath = readSingleLineMarkdownMath(startText);

  if (singleLineMath) {
    return {
      nextLine: source.startLine + 1,
      states: [{
        blockEnd: source.startLine,
        blockStart: source.startLine,
        expression: singleLineMath.expression,
        line: source.startLine,
        role: "open"
      }]
    };
  }

  const openingFence = readMarkdownMathOpeningFence(startText);

  if (!openingFence) {
    return undefined;
  }

  const expressionLines: string[] = [];
  let closeLine: number | undefined;
  let nextLine = source.startLine + 1;

  while (nextLine <= source.lineCount) {
    const text = source.readLine(nextLine);

    if (isMarkdownMathClosingFence(text, openingFence)) {
      closeLine = nextLine;
      break;
    }

    expressionLines.push(text);
    nextLine += 1;
  }

  const blockEnd = closeLine ?? source.lineCount;
  const expression = expressionLines.join("\n").trim();
  const states: MarkdownMathBlockState[] = [{
    blockEnd,
    blockStart: source.startLine,
    expression,
    line: source.startLine,
    role: "open"
  }];

  const contentEndExclusive = closeLine ?? source.lineCount + 1;
  for (let line = source.startLine + 1; line < contentEndExclusive; line += 1) {
    states.push({
      blockEnd,
      blockStart: source.startLine,
      expression,
      line,
      role: "content"
    });
  }

  if (closeLine !== undefined) {
    states.push({
      blockEnd,
      blockStart: source.startLine,
      expression,
      line: closeLine,
      role: "close"
    });
  }

  return {
    nextLine: (closeLine ?? source.lineCount) + 1,
    states
  };
}

function readSingleLineMarkdownMath(
  text: string
): { readonly expression: string; readonly fromColumn: number; readonly toColumn: number } | undefined {
  for (const fence of markdownMathFenceDefinitions) {
    const range = readSingleLineMarkdownMathForFence(text, fence);

    if (range) {
      return range;
    }
  }

  return undefined;
}

const markdownMathFenceDefinitions: readonly MarkdownMathFence[] = [
  { closeMarker: "$$", openMarker: "$$" },
  { closeMarker: "\\]", openMarker: "\\[" }
];

function readMarkdownMathOpeningFence(text: string): MarkdownMathFence | undefined {
  return markdownMathFenceDefinitions.find((fence) => (
    text.trim() === fence.openMarker
  ));
}

function isMarkdownMathClosingFence(text: string, fence: MarkdownMathFence): boolean {
  return text.trim() === fence.closeMarker;
}

function readSingleLineMarkdownMathForFence(
  text: string,
  fence: MarkdownMathFence
): { readonly expression: string; readonly fromColumn: number; readonly toColumn: number } | undefined {
  const trimmedStart = readFirstNonWhitespaceIndex(text);
  const trimmedEnd = readLastNonWhitespaceIndex(text) + 1;
  const openMarkerLength = fence.openMarker.length;
  const closeMarkerLength = fence.closeMarker.length;

  if (
    trimmedEnd - trimmedStart < openMarkerLength + closeMarkerLength ||
    text.slice(trimmedStart, trimmedStart + openMarkerLength) !== fence.openMarker
  ) {
    return undefined;
  }

  const closeFrom = trimmedEnd - closeMarkerLength;

  if (
    closeFrom < trimmedStart + openMarkerLength ||
    text.slice(closeFrom, trimmedEnd) !== fence.closeMarker
  ) {
    return undefined;
  }

  const rawExpression = text.slice(trimmedStart + openMarkerLength, closeFrom);
  if (rawExpression.trim() === "") {
    return {
      expression: "",
      fromColumn: trimmedStart + openMarkerLength,
      toColumn: trimmedStart + openMarkerLength
    };
  }

  const leadingWhitespaceLength = rawExpression.match(/^\s*/)?.[0].length ?? 0;
  const trailingWhitespaceLength = rawExpression.match(/\s*$/)?.[0].length ?? 0;
  const fromColumn = trimmedStart + openMarkerLength + leadingWhitespaceLength;
  const toColumn = Math.max(fromColumn, closeFrom - trailingWhitespaceLength);

  return {
    expression: text.slice(fromColumn, toColumn),
    fromColumn,
    toColumn
  };
}

type MarkdownInlineMathDelimiter = "$" | "\\(";

function findNextInlineMathOpeningDelimiter(
  text: string,
  from: number,
  codeSpanRanges: readonly MarkdownSyntaxMarkerRange[]
): { readonly from: number; readonly marker: MarkdownInlineMathDelimiter; readonly to: number } | undefined {
  for (let index = from; index < text.length; index += 1) {
    if (isIndexInsideMarkdownRange(index, codeSpanRanges)) {
      continue;
    }

    if (text[index] === "$" && isDollarInlineMathDelimiter(text, index)) {
      return { from: index, marker: "$", to: index + 1 };
    }

    if (
      text[index] === "\\" &&
      text[index + 1] === "(" &&
      !isEscaped(text, index)
    ) {
      return { from: index, marker: "\\(", to: index + 2 };
    }
  }

  return undefined;
}

function findNextInlineMathClosingDelimiter(
  text: string,
  from: number,
  marker: MarkdownInlineMathDelimiter,
  codeSpanRanges: readonly MarkdownSyntaxMarkerRange[]
): { readonly from: number; readonly to: number } | undefined {
  for (let index = from; index < text.length; index += 1) {
    if (isIndexInsideMarkdownRange(index, codeSpanRanges)) {
      continue;
    }

    if (marker === "$" && text[index] === "$" && isDollarInlineMathDelimiter(text, index)) {
      return { from: index, to: index + 1 };
    }

    if (
      marker === "\\(" &&
      text[index] === "\\" &&
      text[index + 1] === ")" &&
      !isEscaped(text, index)
    ) {
      return { from: index, to: index + 2 };
    }
  }

  return undefined;
}

function isDollarInlineMathDelimiter(text: string, index: number): boolean {
  return !isEscaped(text, index) &&
    text[index - 1] !== "$" &&
    text[index + 1] !== "$";
}

function canOpenInlineMath(text: string, index: number, marker: MarkdownInlineMathDelimiter): boolean {
  if (marker === "\\(") {
    return true;
  }

  const previous = text[index - 1];
  const next = text[index + 1];
  return Boolean(next && !/\s/.test(next) && !(/\d/.test(next) && (!previous || /\s/.test(previous))));
}

function canCloseInlineMath(text: string, index: number, marker: MarkdownInlineMathDelimiter): boolean {
  if (marker === "\\(") {
    return true;
  }

  const previous = text[index - 1];
  return Boolean(previous && !/\s/.test(previous));
}

interface MarkdownCodeSpanRange extends MarkdownSyntaxMarkerRange {
  readonly contentFrom: number;
  readonly contentTo: number;
}

const markdownAutolinkUriPattern = /^[A-Za-z][A-Za-z0-9.+-]{1,31}:[^\s<>]*$/;
const markdownAutolinkEmailPattern =
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
const markdownInlineHtmlOpeningTagPattern =
  /^<[A-Za-z][A-Za-z0-9-]*(?:\s+[A-Za-z_:][A-Za-z0-9:._-]*(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*\s*\/?>$/;
const markdownInlineHtmlClosingTagPattern = /^<\/[A-Za-z][A-Za-z0-9-]*\s*>$/;
const markdownInlineHtmlDelimitedSyntaxes = [
  { close: "-->", open: "<!--" },
  { close: "]]>", open: "<![CDATA[" }
] as const;

function readMarkdownCodeSpanRanges(text: string): readonly MarkdownCodeSpanRange[] {
  const ranges: MarkdownCodeSpanRange[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const open = findNextBacktickRun(text, cursor);

    if (!open) {
      break;
    }

    const close = findClosingBacktickRun(text, open.to, open.marker);

    if (!close) {
      break;
    }

    ranges.push({
      contentFrom: open.to,
      contentTo: close.from,
      from: open.from,
      to: close.to
    });
    cursor = close.to;
  }

  return ranges;
}

function readMarkdownAutolinkSyntaxRanges(
  text: string,
  ignoredRanges: readonly MarkdownSyntaxMarkerRange[]
): readonly MarkdownSyntaxMarkerRange[] {
  const ranges: MarkdownSyntaxMarkerRange[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const openAngle = findNextMarkdownAutolinkOpen(text, cursor, ignoredRanges);

    if (openAngle === -1) {
      break;
    }

    const closeAngle = findClosingMarkdownAutolinkAngle(text, openAngle, ignoredRanges);

    if (closeAngle === -1) {
      cursor = openAngle + 1;
      continue;
    }

    const content = text.slice(openAngle + 1, closeAngle);

    if (isMarkdownAutolinkContent(content)) {
      ranges.push({ from: openAngle, to: closeAngle + 1 });
    }

    cursor = closeAngle + 1;
  }

  return ranges;
}

function findNextMarkdownAutolinkOpen(
  text: string,
  from: number,
  ignoredRanges: readonly MarkdownSyntaxMarkerRange[]
): number {
  for (let index = from; index < text.length; index += 1) {
    if (
      text[index] === "<" &&
      !isEscaped(text, index) &&
      !isIndexInsideMarkdownRange(index, ignoredRanges)
    ) {
      return index;
    }
  }

  return -1;
}

function findClosingMarkdownAutolinkAngle(
  text: string,
  openAngle: number,
  ignoredRanges: readonly MarkdownSyntaxMarkerRange[]
): number {
  for (let index = openAngle + 1; index < text.length; index += 1) {
    if (
      text[index] === ">" &&
      !isEscaped(text, index) &&
      !isIndexInsideMarkdownRange(index, ignoredRanges)
    ) {
      return index;
    }
  }

  return -1;
}

function isMarkdownAutolinkContent(content: string): boolean {
  return markdownAutolinkUriPattern.test(content) || markdownAutolinkEmailPattern.test(content);
}

function readMarkdownInlineHtmlTagSyntaxRanges(
  text: string,
  ignoredRanges: readonly MarkdownSyntaxMarkerRange[]
): readonly MarkdownSyntaxMarkerRange[] {
  const ranges: MarkdownSyntaxMarkerRange[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const openAngle = findNextMarkdownInlineHtmlTagOpen(text, cursor, ignoredRanges);

    if (openAngle === -1) {
      break;
    }

    const closeAngle = findClosingMarkdownInlineHtmlTagAngle(text, openAngle, ignoredRanges);

    if (closeAngle === -1) {
      cursor = openAngle + 1;
      continue;
    }

    const source = text.slice(openAngle, closeAngle + 1);

    if (isMarkdownInlineHtmlTag(source)) {
      ranges.push({ from: openAngle, to: closeAngle + 1 });
    }

    cursor = closeAngle + 1;
  }

  return ranges;
}

function findNextMarkdownInlineHtmlTagOpen(
  text: string,
  from: number,
  ignoredRanges: readonly MarkdownSyntaxMarkerRange[]
): number {
  for (let index = from; index < text.length; index += 1) {
    if (
      text[index] === "<" &&
      !isEscaped(text, index) &&
      !isIndexInsideMarkdownRange(index, ignoredRanges)
    ) {
      return index;
    }
  }

  return -1;
}

function findClosingMarkdownInlineHtmlTagAngle(
  text: string,
  openAngle: number,
  ignoredRanges: readonly MarkdownSyntaxMarkerRange[]
): number {
  let quote: "'" | "\"" | undefined;

  for (let index = openAngle + 1; index < text.length; index += 1) {
    const character = text[index];

    if (isIndexInsideMarkdownRange(index, ignoredRanges)) {
      continue;
    }

    if (quote) {
      if (character === quote) {
        quote = undefined;
      }
      continue;
    }

    if (character === "'" || character === "\"") {
      quote = character;
      continue;
    }

    if (character === ">" && !isEscaped(text, index)) {
      return index;
    }
  }

  return -1;
}

function isMarkdownInlineHtmlTag(source: string): boolean {
  return markdownInlineHtmlOpeningTagPattern.test(source) || markdownInlineHtmlClosingTagPattern.test(source);
}

function readMarkdownInlineHtmlDelimitedSyntaxRanges(
  text: string,
  ignoredRanges: readonly MarkdownSyntaxMarkerRange[]
): readonly MarkdownSyntaxMarkerRange[] {
  const ranges: MarkdownSyntaxMarkerRange[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const open = findNextMarkdownInlineHtmlDelimitedOpen(text, cursor, ignoredRanges);

    if (!open) {
      break;
    }

    const close = findClosingMarkdownInlineHtmlDelimitedSyntax(text, open, ignoredRanges);

    if (close === -1) {
      cursor = open.from + open.marker.open.length;
      continue;
    }

    ranges.push({ from: open.from, to: close + open.marker.close.length });
    cursor = close + open.marker.close.length;
  }

  return ranges;
}

function findNextMarkdownInlineHtmlDelimitedOpen(
  text: string,
  from: number,
  ignoredRanges: readonly MarkdownSyntaxMarkerRange[]
): { readonly from: number; readonly marker: typeof markdownInlineHtmlDelimitedSyntaxes[number] } | undefined {
  for (let index = from; index < text.length; index += 1) {
    if (isEscaped(text, index) || isIndexInsideMarkdownRange(index, ignoredRanges)) {
      continue;
    }

    const marker = markdownInlineHtmlDelimitedSyntaxes.find((syntax) => text.startsWith(syntax.open, index));

    if (marker) {
      return { from: index, marker };
    }
  }

  return undefined;
}

function findClosingMarkdownInlineHtmlDelimitedSyntax(
  text: string,
  open: { readonly from: number; readonly marker: typeof markdownInlineHtmlDelimitedSyntaxes[number] },
  ignoredRanges: readonly MarkdownSyntaxMarkerRange[]
): number {
  for (let index = open.from + open.marker.open.length; index <= text.length - open.marker.close.length; index += 1) {
    if (
      text.startsWith(open.marker.close, index) &&
      !isMarkdownRangeOverlappingRanges({ from: index, to: index + open.marker.close.length }, ignoredRanges)
    ) {
      return index;
    }
  }

  return -1;
}

function readMarkdownInlineLinkSyntaxRanges(
  text: string,
  ignoredRanges: readonly MarkdownSyntaxMarkerRange[]
): readonly MarkdownSyntaxMarkerRange[] {
  const ranges: MarkdownSyntaxMarkerRange[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const openBracket = findNextMarkdownLinkLabelOpen(text, cursor, ignoredRanges);

    if (openBracket === -1) {
      break;
    }

    const closeBracket = findClosingMarkdownLinkLabelBracket(text, openBracket, ignoredRanges);

    if (closeBracket === -1) {
      cursor = openBracket + 1;
      continue;
    }

    const syntaxFrom = openBracket;
    const openParen = closeBracket + 1;

    if (
      text[openParen] === "(" &&
      !isEscaped(text, openParen) &&
      !isIndexInsideMarkdownRange(openParen, ignoredRanges)
    ) {
      const closeParen = findClosingMarkdownLinkTargetParen(text, openParen, ignoredRanges);

      if (closeParen === -1) {
        cursor = closeBracket + 1;
        continue;
      }

      ranges.push({ from: syntaxFrom, to: closeParen + 1 });
      cursor = closeParen + 1;
      continue;
    }

    const referenceOpenBracket = closeBracket + 1;

    if (
      text[referenceOpenBracket] === "[" &&
      !isEscaped(text, referenceOpenBracket) &&
      !isIndexInsideMarkdownRange(referenceOpenBracket, ignoredRanges)
    ) {
      const referenceCloseBracket = findClosingMarkdownLinkLabelBracket(
        text,
        referenceOpenBracket,
        ignoredRanges
      );

      if (referenceCloseBracket === -1) {
        cursor = closeBracket + 1;
        continue;
      }

      ranges.push({ from: syntaxFrom, to: referenceCloseBracket + 1 });
      cursor = referenceCloseBracket + 1;
      continue;
    }

    if (containsMarkdownTableCellSeparator(text, openBracket + 1, closeBracket, ignoredRanges)) {
      ranges.push({ from: syntaxFrom, to: closeBracket + 1 });
      cursor = closeBracket + 1;
      continue;
    }

    cursor = closeBracket + 1;
  }

  return ranges;
}

function containsMarkdownTableCellSeparator(
  text: string,
  from: number,
  to: number,
  ignoredRanges: readonly MarkdownSyntaxMarkerRange[]
): boolean {
  for (let index = from; index < to; index += 1) {
    if (isMarkdownTableCellSeparator(text, index, ignoredRanges)) {
      return true;
    }
  }

  return false;
}

function findNextMarkdownLinkLabelOpen(
  text: string,
  from: number,
  ignoredRanges: readonly MarkdownSyntaxMarkerRange[]
): number {
  for (let index = from; index < text.length; index += 1) {
    if (
      text[index] === "[" &&
      !isEscaped(text, index) &&
      !isIndexInsideMarkdownRange(index, ignoredRanges)
    ) {
      return index;
    }
  }

  return -1;
}

function findClosingMarkdownLinkLabelBracket(
  text: string,
  openBracket: number,
  ignoredRanges: readonly MarkdownSyntaxMarkerRange[]
): number {
  let depth = 1;

  for (let index = openBracket + 1; index < text.length; index += 1) {
    if (isEscaped(text, index) || isIndexInsideMarkdownRange(index, ignoredRanges)) {
      continue;
    }

    if (text[index] === "[") {
      depth += 1;
      continue;
    }

    if (text[index] === "]") {
      depth -= 1;

      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function findClosingMarkdownLinkTargetParen(
  text: string,
  openParen: number,
  ignoredRanges: readonly MarkdownSyntaxMarkerRange[]
): number {
  let depth = 1;

  for (let index = openParen + 1; index < text.length; index += 1) {
    if (isEscaped(text, index) || isIndexInsideMarkdownRange(index, ignoredRanges)) {
      continue;
    }

    if (text[index] === "(") {
      depth += 1;
      continue;
    }

    if (text[index] === ")") {
      depth -= 1;

      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function readMarkdownInlineRendererRange(
  text: string,
  codeSpan: MarkdownCodeSpanRange
): MarkdownInlineRendererRange | undefined {
  const rawContent = text.slice(codeSpan.contentFrom, codeSpan.contentTo);
  const leadingWhitespaceLength = rawContent.match(/^\s*/)?.[0].length ?? 0;
  const trailingWhitespaceLength = rawContent.match(/\s*$/)?.[0].length ?? 0;
  const contentFrom = codeSpan.contentFrom + leadingWhitespaceLength;
  const contentTo = Math.max(contentFrom, codeSpan.contentTo - trailingWhitespaceLength);
  const content = text.slice(contentFrom, contentTo);
  const match = /^([A-Za-z0-9][A-Za-z0-9_.+-]*):(.*)$/s.exec(content);

  if (!match?.[1]) {
    return undefined;
  }

  const rawValue = match[2] ?? "";
  const valueLeadingWhitespaceLength = rawValue.match(/^\s*/)?.[0].length ?? 0;
  const valueTrailingWhitespaceLength = rawValue.match(/\s*$/)?.[0].length ?? 0;
  const value = rawValue.slice(
    valueLeadingWhitespaceLength,
    rawValue.length - valueTrailingWhitespaceLength
  );

  if (!value) {
    return undefined;
  }

  const valueFrom = contentFrom + match[1].length + 1 + valueLeadingWhitespaceLength;

  return {
    from: codeSpan.from,
    language: match[1].toLowerCase(),
    source: content,
    to: codeSpan.to,
    value,
    valueFrom,
    valueTo: valueFrom + value.length
  };
}

function findNextBacktickRun(
  text: string,
  from: number
): { readonly from: number; readonly marker: string; readonly to: number } | undefined {
  for (let index = from; index < text.length; index += 1) {
    if (text[index] !== "`" || isEscaped(text, index)) {
      continue;
    }

    let to = index + 1;
    while (text[to] === "`") {
      to += 1;
    }

    return { from: index, marker: text.slice(index, to), to };
  }

  return undefined;
}

function findClosingBacktickRun(
  text: string,
  from: number,
  marker: string
): { readonly from: number; readonly to: number } | undefined {
  let cursor = from;

  while (cursor < text.length) {
    const close = findNextBacktickRun(text, cursor);

    if (!close) {
      return undefined;
    }

    if (close.marker === marker) {
      return close;
    }

    cursor = close.to;
  }

  return undefined;
}

function isEscaped(text: string, index: number): boolean {
  let slashCount = 0;

  for (let cursor = index - 1; cursor >= 0 && text[cursor] === "\\"; cursor -= 1) {
    slashCount += 1;
  }

  return slashCount % 2 === 1;
}

function rangesOverlap(
  first: Pick<MarkdownSyntaxMarkerRange, "from" | "to">,
  second: Pick<MarkdownSyntaxMarkerRange, "from" | "to">
): boolean {
  return first.from < second.to && second.from < first.to;
}

function isMarkdownRangeOverlappingRanges(
  range: Pick<MarkdownSyntaxMarkerRange, "from" | "to">,
  ranges: readonly Pick<MarkdownSyntaxMarkerRange, "from" | "to">[]
): boolean {
  return ranges.some((candidate) => rangesOverlap(range, candidate));
}

interface MarkdownTableReadResult {
  readonly nextLine: number;
  readonly states: readonly MarkdownTableReadLineResult[];
}

interface MarkdownTableReadLineResult {
  readonly tableBlock: MarkdownTableBlockState;
  readonly tableLine: MarkdownTableLineState;
}

interface MarkdownTableCellSourceSpan extends MarkdownTableCellSourceRange {
  readonly value: string;
}

function readMarkdownTableFromSource(source: {
  readonly isVisible?: (lineNumber: number) => boolean;
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

  const alignments = delimiterCells.map(readMarkdownTableColumnAlignment);
  const rows: Array<Pick<MarkdownTableLineState, "line" | "role"> & { readonly cells: readonly string[] }> = [
    { cells: headerCells, line: source.startLine, role: "header" },
    { cells: delimiterCells, line: source.startLine + 1, role: "delimiter" }
  ];
  const bodyRows: string[][] = [];
  let nextLine = source.startLine + 2;
  let tableContinuesAfterLookahead = false;

  while (nextLine <= source.lineCount) {
    if (source.lookaheadLimit !== undefined && nextLine > source.lookaheadLimit) {
      tableContinuesAfterLookahead = isMarkdownTableBodyRow(source.readLine(nextLine), delimiterCells.length);
      break;
    }

    const bodyCells = readMarkdownTableBodyCells(source.readLine(nextLine), delimiterCells.length);
    if (!bodyCells) {
      break;
    }

    bodyRows.push([...bodyCells]);
    rows.push({ cells: bodyCells, line: nextLine, role: "body" });
    nextLine += 1;
  }

  const blockEnd = rows.at(-1)?.line ?? source.startLine + 1;
  const visibleRows = source.isVisible ? rows.filter((row) => source.isVisible?.(row.line)) : rows;
  const previewLine = visibleRows.at(0)?.line ?? source.startLine;

  return {
    nextLine,
    states: rows
      .map((row, index) => ({
        tableBlock: {
          alignments,
          blockEnd,
          blockStart: source.startLine,
          bodyRows,
          headerCells,
          line: row.line,
          previewLine,
          role: row.role
        },
        tableLine: {
          first: index === 0,
          last: index === rows.length - 1 && !tableContinuesAfterLookahead,
          line: row.line,
          role: row.role
        }
      }))
      .filter((state) => !source.isVisible || source.isVisible(state.tableLine.line))
  };
}

function isMarkdownTableBodyRow(text: string, columnCount: number): boolean {
  return Boolean(readMarkdownTableBodyCells(text, columnCount));
}

function readMarkdownTableBodyCells(text: string, columnCount: number): readonly string[] | undefined {
  const cells = readMarkdownTableCells(text);
  return cells && cells.length === columnCount && !readMarkdownTableDelimiterCells(text) ? cells : undefined;
}

function readMarkdownTableDelimiterCells(text: string): readonly string[] | undefined {
  const cells = readMarkdownTableCells(text);

  if (!cells || !cells.every((cell) => /^:?-{3,}:?$/.test(cell))) {
    return undefined;
  }

  return cells;
}

function readMarkdownTableCells(text: string): readonly string[] | undefined {
  const spans = readMarkdownTableCellSpans(text);
  const cells = spans?.map((cell) => cell.value.trim());

  return cells && cells.length >= 2 ? cells : undefined;
}

function readMarkdownTableCellSpans(text: string): readonly MarkdownTableCellSourceSpan[] | undefined {
  const trimmedStart = readFirstNonWhitespaceIndex(text);
  const trimmedEnd = readLastNonWhitespaceIndex(text) + 1;

  if (trimmedStart >= trimmedEnd) {
    return undefined;
  }

  const codeSpanRanges = readMarkdownCodeSpanRanges(text);
  const protectedRanges = [
    ...codeSpanRanges,
    ...readMarkdownInlineMathRanges(text, codeSpanRanges),
    ...readMarkdownInlineLinkSyntaxRanges(text, codeSpanRanges),
    ...readMarkdownAutolinkSyntaxRanges(text, codeSpanRanges),
    ...readMarkdownInlineHtmlTagSyntaxRanges(text, codeSpanRanges),
    ...readMarkdownInlineHtmlDelimitedSyntaxRanges(text, codeSpanRanges)
  ];
  const cells: MarkdownTableCellSourceSpan[] = [];
  let current = "";
  let cellStart = trimmedStart;

  for (let index = trimmedStart; index < trimmedEnd; index += 1) {
    const character = text[index];

    if (isMarkdownTableCellSeparator(text, index, protectedRanges)) {
      cells.push({ from: cellStart, to: index, value: current });
      current = "";
      cellStart = index + 1;
      continue;
    }

    current += character;
  }

  cells.push({ from: cellStart, to: trimmedEnd, value: current });

  if (text[trimmedStart] === "|") {
    cells.shift();
  }

  if (text[trimmedEnd - 1] === "|" && !isEscaped(text, trimmedEnd - 1)) {
    cells.pop();
  }

  return cells.length >= 2 ? cells : undefined;
}

function isMarkdownTableCellSeparator(
  text: string,
  index: number,
  codeSpanRanges: readonly MarkdownSyntaxMarkerRange[]
): boolean {
  return text[index] === "|" &&
    !isEscaped(text, index) &&
    !isIndexInsideMarkdownRange(index, codeSpanRanges);
}

function isIndexInsideMarkdownRange(
  index: number,
  ranges: readonly Pick<MarkdownSyntaxMarkerRange, "from" | "to">[]
): boolean {
  return ranges.some((range) => index >= range.from && index < range.to);
}

function readFirstNonWhitespaceIndex(text: string): number {
  for (let index = 0; index < text.length; index += 1) {
    if (!/\s/.test(text[index] ?? "")) {
      return index;
    }
  }

  return text.length;
}

function readLastNonWhitespaceIndex(text: string): number {
  for (let index = text.length - 1; index >= 0; index -= 1) {
    if (!/\s/.test(text[index] ?? "")) {
      return index;
    }
  }

  return -1;
}

function trimMarkdownTableCellSourceRange(span: MarkdownTableCellSourceSpan): MarkdownTableCellSourceRange {
  let from = span.from;
  let to = span.to;

  while (from < to && /\s/.test(span.value[from - span.from] ?? "")) {
    from += 1;
  }

  while (to > from && /\s/.test(span.value[to - span.from - 1] ?? "")) {
    to -= 1;
  }

  return { from, to };
}

function readMarkdownTableColumnAlignment(delimiter: string): MarkdownTableColumnAlignment {
  const startsWithColon = delimiter.startsWith(":");
  const endsWithColon = delimiter.endsWith(":");

  if (startsWithColon && endsWithColon) {
    return "center";
  }

  if (endsWithColon) {
    return "right";
  }

  if (startsWithColon) {
    return "left";
  }

  return "default";
}

function serializeMarkdownTableRow(cells: readonly string[]): string {
  return `| ${cells.map((cell) => cell.trim()).join(" | ")} |`;
}

function createMarkdownTableLines(
  headerCells: readonly string[],
  alignments: readonly MarkdownTableColumnAlignment[],
  bodyRows: readonly (readonly string[])[]
): readonly string[] {
  return [
    serializeMarkdownTableRow(headerCells),
    serializeMarkdownTableDelimiterRow(alignments),
    ...bodyRows.map(serializeMarkdownTableRow)
  ];
}

function serializeMarkdownTableDelimiterRow(alignments: readonly MarkdownTableColumnAlignment[]): string {
  return serializeMarkdownTableRow(alignments.map(serializeMarkdownTableDelimiterCell));
}

function serializeMarkdownTableDelimiterCell(alignment: MarkdownTableColumnAlignment): string {
  if (alignment === "left") {
    return ":---";
  }

  if (alignment === "right") {
    return "---:";
  }

  if (alignment === "center") {
    return ":---:";
  }

  return "---";
}

function clampTableColumnInsertionIndex(columnIndex: number, columnCount: number): number {
  if (!Number.isFinite(columnIndex)) {
    return columnCount;
  }

  return Math.max(0, Math.min(Math.trunc(columnIndex), columnCount));
}

function clampTableColumnIndex(columnIndex: number, columnCount: number): number {
  if (!Number.isFinite(columnIndex)) {
    return 0;
  }

  return Math.max(0, Math.min(Math.trunc(columnIndex), Math.max(0, columnCount - 1)));
}

function clampTableBodyRowInsertionIndex(rowIndex: number, rowCount: number): number {
  if (!Number.isFinite(rowIndex)) {
    return rowCount;
  }

  return Math.max(0, Math.min(Math.trunc(rowIndex), rowCount));
}

function clampTableBodyRowIndex(rowIndex: number, rowCount: number): number {
  if (!Number.isFinite(rowIndex)) {
    return Math.max(0, rowCount - 1);
  }

  return Math.max(0, Math.min(Math.trunc(rowIndex), Math.max(0, rowCount - 1)));
}

function normalizeTableCells(cells: readonly string[], columnCount: number): readonly string[] {
  return Array.from({ length: columnCount }, (_, index) => cells[index] ?? "");
}

function createMarkdownTableEmptyBodyRowCells(columnCount: number): readonly string[] {
  return Array.from({ length: Math.max(1, columnCount) }, () => "");
}

function normalizeTableAlignments(
  alignments: readonly MarkdownTableColumnAlignment[],
  columnCount: number
): readonly MarkdownTableColumnAlignment[] {
  return Array.from({ length: columnCount }, (_, index) => alignments[index] ?? "default");
}

function insertTableArrayItem<T>(items: readonly T[], index: number, item: T): readonly T[] {
  return [...items.slice(0, index), item, ...items.slice(index)];
}

function replaceTableArrayItem<T>(items: readonly T[], index: number, item: T): readonly T[] {
  return items.map((current, currentIndex) => currentIndex === index ? item : current);
}

function removeTableArrayItem<T>(items: readonly T[], index: number): readonly T[] {
  return items.filter((_, currentIndex) => currentIndex !== index);
}

function readCurrentMarkdownTableBlock(view: EditorView, startLine: number): MarkdownTableBlockState | undefined {
  const table = readMarkdownTableFromSource({
    lineCount: view.state.doc.lines,
    readLine: (lineNumber) => view.state.doc.line(lineNumber).text,
    startLine
  });

  return table?.states[0]?.tableBlock;
}

function insertMarkdownTableRowBelow(
  view: EditorView,
  tableBlock: MarkdownTableBlockState,
  rowIndex?: number
): void {
  const currentTableBlock = readCurrentMarkdownTableBlock(view, tableBlock.blockStart);
  if (!currentTableBlock) {
    return;
  }

  replaceMarkdownTableBlock(
    view,
    currentTableBlock,
    createMarkdownTableWithInsertedBodyRow(
      currentTableBlock,
      rowIndex === undefined ? {} : { rowIndex }
    )
  );
}

function deleteMarkdownTableBodyRow(
  view: EditorView,
  tableBlock: MarkdownTableBlockState,
  rowIndex?: number
): void {
  const currentTableBlock = readCurrentMarkdownTableBlock(view, tableBlock.blockStart);
  if (!currentTableBlock) {
    return;
  }

  replaceMarkdownTableBlock(
    view,
    currentTableBlock,
    createMarkdownTableWithDeletedBodyRow(
      currentTableBlock,
      rowIndex === undefined ? {} : { rowIndex }
    )
  );
}

function replaceMarkdownTableBlock(
  view: EditorView,
  tableBlock: MarkdownTableBlockState,
  replacementLines: readonly string[]
): void {
  const startLine = view.state.doc.line(tableBlock.blockStart);
  const endLine = view.state.doc.line(tableBlock.blockEnd);

  view.dispatch({
    changes: { from: startLine.from, to: endLine.to, insert: replacementLines.join("\n") },
    selection: { anchor: startLine.from }
  });
  view.focus();
}

function insertMarkdownTableColumnRight(
  view: EditorView,
  tableBlock: MarkdownTableBlockState,
  columnIndex?: number
): void {
  const currentTableBlock = readCurrentMarkdownTableBlock(view, tableBlock.blockStart);
  if (!currentTableBlock) {
    return;
  }

  replaceMarkdownTableBlock(
    view,
    currentTableBlock,
    createMarkdownTableWithInsertedColumn(
      currentTableBlock,
      columnIndex === undefined ? {} : { columnIndex }
    )
  );
}

function deleteMarkdownTableColumn(
  view: EditorView,
  tableBlock: MarkdownTableBlockState,
  columnIndex?: number
): void {
  const currentTableBlock = readCurrentMarkdownTableBlock(view, tableBlock.blockStart);
  if (!currentTableBlock) {
    return;
  }

  replaceMarkdownTableBlock(
    view,
    currentTableBlock,
    createMarkdownTableWithDeletedColumn(
      currentTableBlock,
      columnIndex === undefined ? {} : { columnIndex }
    )
  );
}

function updateMarkdownTableColumnAlignment(
  view: EditorView,
  tableBlock: MarkdownTableBlockState,
  columnIndex: number,
  alignment: MarkdownTableColumnAlignment
): void {
  const currentTableBlock = readCurrentMarkdownTableBlock(view, tableBlock.blockStart);
  if (!currentTableBlock) {
    return;
  }

  replaceMarkdownTableBlock(
    view,
    currentTableBlock,
    createMarkdownTableWithUpdatedColumnAlignment(currentTableBlock, { alignment, columnIndex })
  );
}

class MarkdownTableBlockWidget extends WidgetType {
  constructor(private readonly tableBlock: MarkdownTableBlockState) {
    super();
  }

  override eq(widget: WidgetType): boolean {
    return widget instanceof MarkdownTableBlockWidget &&
      serializeTableBlock(widget.tableBlock) === serializeTableBlock(this.tableBlock);
  }

  override toDOM(view: EditorView): HTMLElement {
    const wrapper = document.createElement("span");
    wrapper.className = "tp-editor-table-preview";
    wrapper.setAttribute("aria-label", "Table preview");
    wrapper.setAttribute("role", "group");

    const toolbar = document.createElement("span");
    toolbar.className = "tp-editor-table-toolbar";

    const label = document.createElement("span");
    label.className = "tp-editor-table-label";
    label.textContent = "Table";

    const actions = document.createElement("span");
    actions.className = "tp-editor-table-actions";
    actions.append(
      createTableToolButton({
        className: "tp-editor-table-insert-row",
        text: "Row +",
        title: "Insert row below",
        onClick: () => insertMarkdownTableRowBelow(view, this.tableBlock)
      }),
      createTableToolButton({
        className: "tp-editor-table-delete-row",
        disabled: this.tableBlock.bodyRows.length === 0,
        text: "Row -",
        title: "Delete last row",
        onClick: () => deleteMarkdownTableBodyRow(view, this.tableBlock)
      }),
      createTableToolButton({
        className: "tp-editor-table-insert-column",
        text: "Col +",
        title: "Insert column right",
        onClick: () => insertMarkdownTableColumnRight(view, this.tableBlock)
      }),
      createTableToolButton({
        className: "tp-editor-table-delete-column",
        disabled: this.tableBlock.headerCells.length <= markdownTableMinimumColumnCount,
        text: "Col -",
        title: "Delete last column",
        onClick: () => deleteMarkdownTableColumn(view, this.tableBlock)
      })
    );

    toolbar.append(label, actions);

    const scroll = document.createElement("span");
    scroll.className = "tp-editor-table-scroll";

    const table = document.createElement("table");
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");

    this.tableBlock.headerCells.forEach((cell, index) => {
      const headerCell = document.createElement("th");
      headerCell.scope = "col";
      setTableCellAlignment(headerCell, this.tableBlock.alignments[index]);
      addTableCellSourceNavigation(headerCell, view, this.tableBlock.blockStart, index);

      const content = document.createElement("span");
      content.className = "tp-editor-table-header-content";

      const label = document.createElement("span");
      label.className = "tp-editor-table-header-label";
      label.textContent = readMarkdownTableCellPreviewText(cell);

      const controls = document.createElement("span");
      controls.className = "tp-editor-table-header-controls";
      controls.append(
        createTableAlignmentButton({
          alignment: this.tableBlock.alignments[index] ?? "default",
          columnIndex: index,
          onClick: (alignment) => updateMarkdownTableColumnAlignment(view, this.tableBlock, index, alignment)
        }),
        createTableInlineButton({
          className: "tp-editor-table-insert-column-inline",
          text: "+",
          title: `Insert column after column ${index + 1}`,
          onClick: () => insertMarkdownTableColumnRight(view, this.tableBlock, index + 1)
        }),
        createTableInlineButton({
          className: "tp-editor-table-delete-column-inline",
          disabled: this.tableBlock.headerCells.length <= markdownTableMinimumColumnCount,
          text: "-",
          title: `Delete column ${index + 1}`,
          onClick: () => deleteMarkdownTableColumn(view, this.tableBlock, index)
        })
      );

      content.append(label, controls);
      headerCell.append(content);
      headerRow.append(headerCell);
    });

    thead.append(headerRow);
    table.append(thead);

    if (this.tableBlock.bodyRows.length > 0) {
      const tbody = document.createElement("tbody");

      for (const [rowIndex, row] of this.tableBlock.bodyRows.entries()) {
        const bodyRow = document.createElement("tr");

        row.forEach((cell, index) => {
          const bodyCell = document.createElement("td");
          setTableCellAlignment(bodyCell, this.tableBlock.alignments[index]);
          addTableCellSourceNavigation(bodyCell, view, this.tableBlock.blockStart + rowIndex + 2, index);

          if (index === 0) {
            const content = document.createElement("span");
            content.className = "tp-editor-table-cell-content";

            const label = document.createElement("span");
            label.className = "tp-editor-table-cell-label";
            label.textContent = readMarkdownTableCellPreviewText(cell);

            const controls = document.createElement("span");
            controls.className = "tp-editor-table-cell-controls";
            controls.append(
              createTableInlineButton({
                className: "tp-editor-table-insert-row-inline",
                text: "+",
                title: `Insert row below row ${rowIndex + 1}`,
                onClick: () => insertMarkdownTableRowBelow(view, this.tableBlock, rowIndex + 1)
              }),
              createTableInlineButton({
                className: "tp-editor-table-delete-row-inline",
                text: "-",
                title: `Delete row ${rowIndex + 1}`,
                onClick: () => deleteMarkdownTableBodyRow(view, this.tableBlock, rowIndex)
              })
            );

            content.append(label, controls);
            bodyCell.append(content);
          } else {
            bodyCell.textContent = readMarkdownTableCellPreviewText(cell);
          }

          bodyRow.append(bodyCell);
        });

        tbody.append(bodyRow);
      }

      table.append(tbody);
    }

    scroll.append(table);
    wrapper.append(toolbar, scroll);
    return wrapper;
  }

  override get estimatedHeight(): number {
    return tablePreviewToolbarEstimatedHeight + tablePreviewHeaderEstimatedHeight +
      Math.max(1, this.tableBlock.bodyRows.length) * tablePreviewRowEstimatedHeight;
  }

  override ignoreEvent(event: Event): boolean {
    return isPreviewInteractiveEvent(event) || isTableCellSourceNavigationEvent(event);
  }
}

interface TableToolButtonOptions {
  readonly className: string;
  readonly disabled?: boolean;
  readonly onClick: () => void;
  readonly text: string;
  readonly title: string;
}

function createTableToolButton(options: TableToolButtonOptions): HTMLButtonElement {
  const button = document.createElement("button");
  button.className = `tp-editor-table-tool ${options.className}`;
  button.type = "button";
  button.disabled = options.disabled ?? false;
  button.textContent = options.text;
  button.title = options.title;
  button.setAttribute("aria-label", options.title);
  addPreviewButtonHandlers(button, options.onClick);

  return button;
}

interface TableInlineButtonOptions {
  readonly className: string;
  readonly disabled?: boolean;
  readonly onClick: () => void;
  readonly text: string;
  readonly title: string;
}

function createTableInlineButton(options: TableInlineButtonOptions): HTMLButtonElement {
  const button = document.createElement("button");
  button.className = `tp-editor-table-inline-tool ${options.className}`;
  button.type = "button";
  button.disabled = options.disabled ?? false;
  button.textContent = options.text;
  button.title = options.title;
  button.setAttribute("aria-label", options.title);
  addPreviewButtonHandlers(button, options.onClick);

  return button;
}

interface TableAlignmentButtonOptions {
  readonly alignment: MarkdownTableColumnAlignment;
  readonly columnIndex: number;
  readonly onClick: (alignment: MarkdownTableColumnAlignment) => void;
}

function createTableAlignmentButton(options: TableAlignmentButtonOptions): HTMLButtonElement {
  const nextAlignment = getNextMarkdownTableColumnAlignment(options.alignment);
  const title = `Set column ${options.columnIndex + 1} alignment to ${readTableAlignmentLabel(nextAlignment)}`;
  const button = document.createElement("button");
  button.className = "tp-editor-table-align";
  button.type = "button";
  button.textContent = readTableAlignmentButtonText(options.alignment);
  button.title = title;
  button.dataset.align = options.alignment;
  button.setAttribute("aria-label", title);
  addPreviewButtonHandlers(button, () => options.onClick(nextAlignment));

  return button;
}

function addPreviewButtonHandlers(button: HTMLButtonElement, onClick: () => void): void {
  button.addEventListener("mousedown", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onClick();
  });
}

function addTableCellSourceNavigation(
  cell: HTMLTableCellElement,
  view: EditorView,
  lineNumber: number,
  columnIndex: number
): void {
  cell.classList.add("tp-editor-table-source-cell");
  cell.dataset.tableCellSource = "true";
  cell.title = `Edit source for column ${columnIndex + 1}`;
  cell.addEventListener("mousedown", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  cell.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    focusMarkdownTableCellSource(view, lineNumber, columnIndex);
  });
}

function focusMarkdownTableCellSource(view: EditorView, lineNumber: number, columnIndex: number): void {
  if (lineNumber < 1 || lineNumber > view.state.doc.lines) {
    return;
  }

  const sourceLine = view.state.doc.line(lineNumber);
  const cellRange = findMarkdownTableCellSourceRange(sourceLine.text, columnIndex);

  if (!cellRange) {
    return;
  }

  const from = sourceLine.from + cellRange.from;
  const to = sourceLine.from + cellRange.to;

  view.dispatch({
    selection: { anchor: from, head: to },
    scrollIntoView: true
  });
  view.focus();
}

function isTableCellSourceNavigationEvent(event: Event): boolean {
  return event.target instanceof Element && Boolean(event.target.closest("[data-table-cell-source='true']"));
}

function readTableAlignmentButtonText(alignment: MarkdownTableColumnAlignment): string {
  if (alignment === "left") {
    return "L";
  }

  if (alignment === "center") {
    return "C";
  }

  if (alignment === "right") {
    return "R";
  }

  return "A";
}

function readTableAlignmentLabel(alignment: MarkdownTableColumnAlignment): string {
  if (alignment === "default") {
    return "Auto";
  }

  return alignment.charAt(0).toUpperCase() + alignment.slice(1);
}

function setTableCellAlignment(cell: HTMLTableCellElement, alignment: MarkdownTableColumnAlignment | undefined): void {
  cell.dataset.align = alignment ?? "default";
}

function readMarkdownTableCellPreviewText(cell: string): string {
  let preview = "";

  for (let index = 0; index < cell.length; index += 1) {
    const character = cell[index];

    if (character === "|" && isEscaped(cell, index)) {
      preview = preview.slice(0, -1) + "|";
      continue;
    }

    preview += character;
  }

  return preview;
}

function serializeTableBlock(tableBlock: MarkdownTableBlockState): string {
  return JSON.stringify({
    alignments: tableBlock.alignments,
    bodyRows: tableBlock.bodyRows,
    headerCells: tableBlock.headerCells
  });
}

class MarkdownCodeFenceHeaderWidget extends WidgetType {
  constructor(private readonly codeFence: MarkdownCodeFenceBlockState) {
    super();
  }

  override eq(widget: WidgetType): boolean {
    return widget instanceof MarkdownCodeFenceHeaderWidget &&
      widget.codeFence.content === this.codeFence.content &&
      widget.codeFence.info === this.codeFence.info &&
      widget.codeFence.language === this.codeFence.language;
  }

  override toDOM(): HTMLElement {
    const toolbar = document.createElement("span");
    toolbar.className = "tp-editor-code-toolbar";
    toolbar.setAttribute("aria-label", "Code block tools");
    toolbar.setAttribute("role", "group");

    const language = document.createElement("span");
    language.className = "tp-editor-code-language";
    language.textContent = this.codeFence.language || "Code";

    const copyButton = createPreviewCopyButton({
      className: "tp-editor-code-copy",
      content: this.codeFence.content,
      copiedAriaLabel: "Code copied",
      copiedTitle: "Copied",
      defaultAriaLabel: "Copy code",
      defaultTitle: "Copy code",
      text: "Copy"
    });

    toolbar.append(language, copyButton);
    return toolbar;
  }

  override ignoreEvent(event: Event): boolean {
    return isPreviewInteractiveEvent(event);
  }
}

class MarkdownExternalCodeFenceWidget extends WidgetType {
  private disposed = false;

  constructor(
    private readonly codeFence: MarkdownCodeFenceBlockState,
    private readonly renderCodeFence: MarkdownCodeFenceRenderer
  ) {
    super();
  }

  override eq(widget: WidgetType): boolean {
    return widget instanceof MarkdownExternalCodeFenceWidget &&
      widget.codeFence.content === this.codeFence.content &&
      widget.codeFence.info === this.codeFence.info &&
      widget.codeFence.language === this.codeFence.language &&
      widget.renderCodeFence === this.renderCodeFence;
  }

  override toDOM(view: EditorView): HTMLElement {
    this.disposed = false;
    const block = document.createElement("span");
    block.className = "tp-editor-renderer-block tp-editor-renderer-loading";
    block.setAttribute("aria-label", "Rendered code block");
    block.setAttribute("role", "group");

    const toolbar = document.createElement("span");
    toolbar.className = "tp-editor-renderer-toolbar";

    const label = document.createElement("span");
    label.className = "tp-editor-renderer-label";
    label.textContent = readCodeFencePreviewLabel(this.codeFence);

    const copyButton = createPreviewCopyButton({
      className: "tp-editor-renderer-copy",
      content: this.codeFence.content,
      copiedAriaLabel: "Code copied",
      copiedTitle: "Copied",
      defaultAriaLabel: "Copy code",
      defaultTitle: "Copy code",
      text: "Copy"
    });

    toolbar.append(label, copyButton);

    const body = document.createElement("span");
    body.className = "tp-editor-renderer-body";
    addCodeFenceSourceNavigation(body, view, this.codeFence);
    renderExternalCodeFenceLoading(body);

    block.append(toolbar, body);
    void this.renderExternalPreview(block, body, label, view);
    return block;
  }

  override destroy(): void {
    this.disposed = true;
  }

  override get estimatedHeight(): number {
    const lineCount = Math.max(1, this.codeFence.content.split(/\r?\n/).length);
    return Math.min(
      externalRendererEstimatedMaxHeightPx,
      Math.max(externalRendererEstimatedMinHeightPx, 60 + lineCount * externalRendererLineEstimatedHeightPx)
    );
  }

  override ignoreEvent(event: Event): boolean {
    return isPreviewInteractiveEvent(event) || isCodeFenceSourceNavigationEvent(event);
  }

  private async renderExternalPreview(
    block: HTMLElement,
    body: HTMLElement,
    label: HTMLElement,
    view: EditorView
  ): Promise<void> {
    try {
      const result = await this.renderCodeFence.render({
        info: this.codeFence.info,
        language: this.codeFence.language,
        value: this.codeFence.content
      });

      if (this.disposed) {
        return;
      }

      if (!result) {
        renderExternalCodeFenceFallback(body, this.codeFence.content);
        block.classList.remove("tp-editor-renderer-loading", "tp-editor-renderer-error");
        block.classList.add("tp-editor-renderer-fallback");
        view.requestMeasure();
        return;
      }

      label.textContent = result.label || readCodeFencePreviewLabel(this.codeFence);
      renderSanitizedMarkdownRendererHtml(body, result.html);
      block.classList.remove("tp-editor-renderer-loading", "tp-editor-renderer-error", "tp-editor-renderer-fallback");
      block.classList.add("tp-editor-renderer-ready");
      view.requestMeasure();
    } catch (error) {
      if (this.disposed) {
        return;
      }

      renderExternalCodeFenceError(body, readRendererErrorMessage(error));
      block.classList.remove("tp-editor-renderer-loading", "tp-editor-renderer-ready");
      block.classList.add("tp-editor-renderer-error");
      view.requestMeasure();
    }
  }
}

function readCodeFencePreviewLabel(codeFence: MarkdownCodeFenceBlockState): string {
  return codeFence.language || "Code";
}

function canRenderCodeFence(
  renderer: MarkdownCodeFenceRenderer,
  codeFence: MarkdownCodeFenceBlockState
): boolean {
  return renderer.canRender
    ? renderer.canRender({
      info: codeFence.info,
      language: codeFence.language,
      value: codeFence.content
    })
    : true;
}

function findRenderableMarkdownInlineRendererRanges(
  text: string,
  active: boolean,
  renderer: MarkdownInlineRenderer | undefined
): readonly MarkdownInlineRendererRange[] {
  if (!renderer) {
    return [];
  }

  return findInactiveMarkdownInlineRendererRanges(text, active)
    .filter((range) => canRenderInline(renderer, range));
}

function canRenderInline(
  renderer: MarkdownInlineRenderer,
  inline: Pick<MarkdownInlineRendererRange, "language" | "value">
): boolean {
  return renderer.canRender
    ? renderer.canRender({
      language: inline.language,
      value: inline.value
    })
    : true;
}

function renderExternalCodeFenceLoading(body: HTMLElement): void {
  body.className = "tp-editor-renderer-body tp-editor-renderer-placeholder";
  body.textContent = "Rendering preview...";
}

function renderExternalCodeFenceFallback(body: HTMLElement, content: string): void {
  body.className = "tp-editor-renderer-body tp-editor-renderer-source";
  body.textContent = "";

  const pre = document.createElement("pre");
  const code = document.createElement("code");
  code.textContent = content || " ";
  pre.append(code);
  body.append(pre);
}

function renderExternalCodeFenceError(body: HTMLElement, message: string): void {
  body.className = "tp-editor-renderer-body tp-editor-renderer-placeholder";
  body.textContent = `Renderer unavailable: ${message}`;
}

function renderSanitizedMarkdownRendererHtml(body: HTMLElement, html: string): void {
  body.className = "tp-editor-renderer-body tp-editor-renderer-html";
  body.textContent = "";
  body.append(sanitizeMarkdownRendererHtml(html));
}

export function sanitizeMarkdownRendererHtml(html: string): DocumentFragment {
  return sanitizeMarkdownRendererHtmlWithAllowedTags(html, allowedRendererHtmlTags);
}

export function sanitizeMarkdownInlineRendererHtml(html: string): DocumentFragment {
  return sanitizeMarkdownRendererHtmlWithAllowedTags(html, allowedInlineRendererHtmlTags);
}

function sanitizeMarkdownRendererHtmlWithAllowedTags(
  html: string,
  allowedTags: ReadonlySet<string>
): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const parserDocument = document.implementation.createHTMLDocument("markdown-renderer");
  parserDocument.body.innerHTML = html;

  for (const child of Array.from(parserDocument.body.childNodes)) {
    const sanitized = sanitizeMarkdownRendererNode(child, allowedTags);

    if (sanitized) {
      fragment.append(sanitized);
    }
  }

  return fragment;
}

function sanitizeMarkdownRendererNode(node: Node, allowedTags: ReadonlySet<string>): Node | undefined {
  if (node.nodeType === Node.TEXT_NODE) {
    return document.createTextNode(node.textContent ?? "");
  }

  if (!(node instanceof Element)) {
    return undefined;
  }

  const tagName = node.tagName.toLowerCase();

  if (blockedRendererHtmlTags.has(tagName)) {
    return undefined;
  }

  if (!allowedTags.has(tagName)) {
    const fragment = document.createDocumentFragment();

    for (const child of Array.from(node.childNodes)) {
      const sanitized = sanitizeMarkdownRendererNode(child, allowedTags);

      if (sanitized) {
        fragment.append(sanitized);
      }
    }

    return fragment;
  }

  const element = document.createElement(tagName);
  copySafeRendererAttributes(node, element);

  if (tagName === "img" && !element.hasAttribute("src")) {
    return undefined;
  }

  for (const child of Array.from(node.childNodes)) {
    const sanitized = sanitizeMarkdownRendererNode(child, allowedTags);

    if (sanitized) {
      element.append(sanitized);
    }
  }

  return element;
}

const allowedRendererHtmlTags = new Set([
  "b",
  "br",
  "caption",
  "code",
  "col",
  "colgroup",
  "dd",
  "div",
  "dl",
  "dt",
  "em",
  "figcaption",
  "figure",
  "hr",
  "i",
  "img",
  "li",
  "ol",
  "p",
  "pre",
  "small",
  "span",
  "strong",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "ul"
]);

const allowedInlineRendererHtmlTags = new Set([
  "b",
  "br",
  "code",
  "em",
  "i",
  "img",
  "small",
  "span",
  "strong"
]);

const blockedRendererHtmlTags = new Set([
  "iframe",
  "link",
  "meta",
  "object",
  "script",
  "style"
]);

const allowedRendererHtmlAttributes = new Set([
  "aria-label",
  "aria-labelledby",
  "alt",
  "class",
  "colspan",
  "data-align",
  "role",
  "rowspan",
  "src",
  "title"
]);

function copySafeRendererAttributes(source: Element, target: HTMLElement): void {
  for (const attribute of Array.from(source.attributes)) {
    const name = attribute.name.toLowerCase();

    if (!allowedRendererHtmlAttributes.has(name)) {
      continue;
    }

    if (name === "class") {
      const className = sanitizeRendererClassName(attribute.value);
      if (className) {
        target.className = className;
      }
      continue;
    }

    if (name === "src" && (!isRendererImageElement(target) || !isSafeRendererImageSource(attribute.value))) {
      continue;
    }

    if (name === "alt" && !isRendererImageElement(target)) {
      continue;
    }

    if ((name === "colspan" || name === "rowspan") && !/^[1-9][0-9]?$/.test(attribute.value)) {
      continue;
    }

    target.setAttribute(name, attribute.value);
  }
}

function isRendererImageElement(element: HTMLElement): boolean {
  return element.tagName.toLowerCase() === "img";
}

function isSafeRendererImageSource(value: string): boolean {
  return /^data:image\/(?:svg\+xml|png|gif|jpeg|webp);[A-Za-z0-9+/,;:=._%!'()*~-]+$/i.test(value.trim());
}

function sanitizeRendererClassName(value: string): string {
  return value
    .split(/\s+/)
    .filter((className) => /^tp-renderer-[A-Za-z0-9_-]+$/.test(className))
    .join(" ");
}

function addCodeFenceSourceNavigation(
  body: HTMLElement,
  view: EditorView,
  codeFence: MarkdownCodeFenceBlockState
): void {
  body.dataset.codeFenceSource = "true";
  body.title = "Edit code source";
  body.addEventListener("mousedown", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  body.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    focusMarkdownCodeFenceSource(view, codeFence);
  });
}

function focusMarkdownCodeFenceSource(view: EditorView, codeFence: MarkdownCodeFenceBlockState): void {
  if (codeFence.blockStart < 1 || codeFence.blockEnd > view.state.doc.lines || codeFence.blockStart > codeFence.blockEnd) {
    return;
  }

  const lines: string[] = [];
  for (let lineNumber = codeFence.blockStart; lineNumber <= codeFence.blockEnd; lineNumber += 1) {
    lines.push(view.state.doc.line(lineNumber).text);
  }

  const sourceRange = findMarkdownCodeFenceSourceRange(lines);
  if (!sourceRange) {
    return;
  }

  const fromLine = view.state.doc.line(codeFence.blockStart + sourceRange.fromLine - 1);
  const toLine = view.state.doc.line(codeFence.blockStart + sourceRange.toLine - 1);
  const from = fromLine.from + Math.min(sourceRange.fromColumn, fromLine.length);
  const to = toLine.from + Math.min(sourceRange.toColumn, toLine.length);

  view.dispatch({
    selection: { anchor: from, head: to },
    effects: EditorView.scrollIntoView(from, { y: "center" })
  });
  view.focus();
}

function isCodeFenceSourceNavigationEvent(event: Event): boolean {
  return event.target instanceof Element && Boolean(event.target.closest("[data-code-fence-source='true']"));
}

function readRendererErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

interface PreviewCopyButtonOptions {
  readonly className: string;
  readonly content: string;
  readonly copiedAriaLabel: string;
  readonly copiedTitle: string;
  readonly defaultAriaLabel: string;
  readonly defaultTitle: string;
  readonly text: string;
}

function createPreviewCopyButton(options: PreviewCopyButtonOptions): HTMLButtonElement {
  const copyButton = document.createElement("button");
  copyButton.className = `tp-editor-preview-copy ${options.className}`;
  copyButton.type = "button";
  copyButton.textContent = options.text;
  copyButton.title = options.defaultTitle;
  copyButton.setAttribute("aria-label", options.defaultAriaLabel);
  copyButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    void copyPreviewContent(options.content, copyButton, options);
  });

  return copyButton;
}

async function copyPreviewContent(
  content: string,
  button: HTMLButtonElement,
  options: Pick<PreviewCopyButtonOptions, "copiedAriaLabel" | "copiedTitle" | "defaultAriaLabel" | "defaultTitle">
): Promise<void> {
  const copied = await writeClipboardText(content);
  if (!copied) {
    return;
  }

  button.dataset.copied = "true";
  button.setAttribute("aria-label", options.copiedAriaLabel);
  button.title = options.copiedTitle;
  window.setTimeout(() => {
    button.dataset.copied = "false";
    button.setAttribute("aria-label", options.defaultAriaLabel);
    button.title = options.defaultTitle;
  }, previewCopyFeedbackDurationMs);
}

function isPreviewInteractiveEvent(event: Event): boolean {
  if (!(event.target instanceof Element)) {
    return false;
  }

  const interactiveTarget = event.target.closest("button");
  return shouldIgnorePreviewEventTarget(interactiveTarget?.tagName);
}

async function writeClipboardText(content: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(content);
      return true;
    } catch {
      // Fall through to the textarea fallback for environments without clipboard permission.
    }
  }

  return writeClipboardTextWithTextarea(content);
}

function writeClipboardTextWithTextarea(content: string): boolean {
  const textarea = document.createElement("textarea");
  textarea.value = content;
  textarea.setAttribute("aria-hidden", "true");
  textarea.tabIndex = -1;
  textarea.style.position = "fixed";
  textarea.style.inset = "0";
  textarea.style.opacity = "0";

  document.body.append(textarea);
  textarea.select();

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}

class MarkdownImageBlockWidget extends WidgetType {
  constructor(
    private readonly image: MarkdownImageBlockState,
    private readonly resolveImageSource: MarkdownImageSourceResolver | undefined
  ) {
    super();
  }

  override eq(widget: WidgetType): boolean {
    return widget instanceof MarkdownImageBlockWidget &&
      widget.image.altText === this.image.altText &&
      widget.image.previewable === this.image.previewable &&
      widget.image.source === this.image.source &&
      widget.image.sourceLabel === this.image.sourceLabel &&
      widget.image.title === this.image.title &&
      widget.resolveImageSource === this.resolveImageSource;
  }

  override toDOM(view: EditorView): HTMLElement {
    const figure = document.createElement("span");
    figure.className = "tp-editor-image-block";
    figure.setAttribute("aria-label", this.image.altText || this.image.sourceLabel);
    figure.setAttribute("role", "group");

    const preview = document.createElement("span");
    this.renderPreview(preview, view);

    const caption = document.createElement("span");
    caption.className = "tp-editor-image-caption";

    const title = document.createElement("strong");
    title.textContent = this.image.altText || this.image.title || this.image.sourceLabel;

    const source = document.createElement("span");
    source.textContent = this.image.sourceLabel;

    caption.append(title, source);
    figure.append(preview, caption);
    return figure;
  }

  override get estimatedHeight(): number {
    return 104;
  }

  override ignoreEvent(): boolean {
    return false;
  }

  private renderPreview(preview: HTMLElement, view: EditorView): void {
    if (this.image.previewable) {
      this.renderImagePreview(preview, this.image.source, view);
      return;
    }

    this.renderPlaceholder(preview);

    if (!this.resolveImageSource) {
      return;
    }

    Promise.resolve(this.resolveImageSource(this.image.source))
      .then((resolvedSource) => {
        if (!resolvedSource) {
          return;
        }

        this.renderImagePreview(preview, resolvedSource, view);
      })
      .catch(() => {
        this.renderPlaceholder(preview);
      });
  }

  private renderImagePreview(preview: HTMLElement, source: string, view: EditorView): void {
    preview.className = "tp-editor-image-preview";
    preview.textContent = "";

    const image = document.createElement("img");
    image.alt = this.image.altText;
    image.decoding = "async";
    image.loading = "lazy";
    image.src = source;
    image.addEventListener("load", () => view.requestMeasure());
    image.addEventListener("error", () => {
      this.renderPlaceholder(preview);
      view.requestMeasure();
    });
    preview.append(image);
  }

  private renderPlaceholder(preview: HTMLElement): void {
    preview.className = "tp-editor-image-placeholder";
    preview.textContent = "IMG";
  }
}

class MarkdownMathBlockWidget extends WidgetType {
  constructor(private readonly math: MarkdownMathBlockState) {
    super();
  }

  override eq(widget: WidgetType): boolean {
    return widget instanceof MarkdownMathBlockWidget &&
      widget.math.blockEnd === this.math.blockEnd &&
      widget.math.blockStart === this.math.blockStart &&
      widget.math.expression === this.math.expression;
  }

  override toDOM(view: EditorView): HTMLElement {
    const renderResult = renderMarkdownMathExpression(this.math.expression, true);
    const block = document.createElement("span");
    block.className = `tp-editor-math-preview tp-editor-math-preview-state-${renderResult.status}`;
    block.setAttribute("aria-label", "Math preview");

    const toolbar = document.createElement("span");
    toolbar.className = "tp-editor-math-toolbar";

    const label = document.createElement("span");
    label.className = "tp-editor-math-label";
    label.textContent = readMathPreviewLabel(renderResult.status);

    const copyButton = createPreviewCopyButton({
      className: "tp-editor-math-copy",
      content: this.math.expression,
      copiedAriaLabel: "TeX copied",
      copiedTitle: "Copied",
      defaultAriaLabel: "Copy TeX",
      defaultTitle: "Copy TeX",
      text: "Copy"
    });

    toolbar.append(label, copyButton);
    block.append(toolbar);

    const body = document.createElement("span");
    body.className = "tp-editor-math-body";
    addMathBlockSourceNavigation(body, view, this.math);

    if (renderResult.status === "empty") {
      body.textContent = "Empty math block";
      body.classList.add("tp-editor-math-preview-empty");
      block.append(body);
      return block;
    }

    if (renderResult.status === "error") {
      body.textContent = `Invalid TeX: ${renderResult.error}`;
      body.title = renderResult.source;
      body.classList.add("tp-editor-math-preview-error");
      block.append(body);
      return block;
    }

    body.innerHTML = renderResult.html ?? "";
    block.append(body);
    return block;
  }

  override get estimatedHeight(): number {
    return mathPreviewEstimatedHeight;
  }

  override ignoreEvent(event: Event): boolean {
    return isPreviewInteractiveEvent(event) || isMathBlockSourceNavigationEvent(event);
  }
}

function addMathBlockSourceNavigation(
  body: HTMLElement,
  view: EditorView,
  math: MarkdownMathBlockState
): void {
  body.dataset.mathBlockSource = "true";
  body.title = "Edit TeX source";
  body.addEventListener("mousedown", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  body.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    focusMarkdownMathBlockSource(view, math);
  });
}

function focusMarkdownMathBlockSource(view: EditorView, math: MarkdownMathBlockState): void {
  if (math.blockStart < 1 || math.blockEnd > view.state.doc.lines || math.blockStart > math.blockEnd) {
    return;
  }

  const blockLines: string[] = [];
  for (let lineNumber = math.blockStart; lineNumber <= math.blockEnd; lineNumber += 1) {
    blockLines.push(view.state.doc.line(lineNumber).text);
  }

  const sourceRange = findMarkdownMathBlockSourceRange(blockLines);
  if (!sourceRange) {
    return;
  }

  const fromLine = view.state.doc.line(math.blockStart + sourceRange.fromLine - 1);
  const toLine = view.state.doc.line(math.blockStart + sourceRange.toLine - 1);
  const from = fromLine.from + Math.min(sourceRange.fromColumn, fromLine.length);
  const to = toLine.from + Math.min(sourceRange.toColumn, toLine.length);

  view.dispatch({
    selection: { anchor: from, head: to },
    scrollIntoView: true
  });
  view.focus();
}

function isMathBlockSourceNavigationEvent(event: Event): boolean {
  return event.target instanceof Element && Boolean(event.target.closest("[data-math-block-source='true']"));
}

class MarkdownInlineMathWidget extends WidgetType {
  constructor(
    private readonly math: MarkdownInlineMathRange,
    private readonly sourceFrom: number,
    private readonly sourceTo: number,
    private readonly expressionFrom: number,
    private readonly expressionTo: number
  ) {
    super();
  }

  override eq(widget: WidgetType): boolean {
    return widget instanceof MarkdownInlineMathWidget &&
      widget.math.expression === this.math.expression &&
      widget.sourceFrom === this.sourceFrom &&
      widget.sourceTo === this.sourceTo &&
      widget.expressionFrom === this.expressionFrom &&
      widget.expressionTo === this.expressionTo;
  }

  override toDOM(view: EditorView): HTMLElement {
    const renderResult = renderMarkdownMathExpression(this.math.expression, false);
    const inline = document.createElement("span");
    inline.className = `tp-editor-inline-math-preview tp-editor-inline-math-preview-${renderResult.status}`;
    inline.setAttribute("aria-label", renderResult.status === "error" ? "Invalid inline math" : "Inline math preview");
    inline.dataset.inlineMathSource = "true";
    inline.title = renderResult.status === "error"
      ? `Invalid TeX: ${renderResult.error ?? ""}`
      : "Edit inline math";
    inline.addEventListener("mousedown", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    inline.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      focusMarkdownInlineMathSource(view, this.expressionFrom, this.expressionTo);
    });

    if (renderResult.status !== "valid") {
      inline.textContent = renderResult.status === "empty" ? "" : renderResult.source;
      inline.classList.add("tp-editor-inline-math-preview-error");
      return inline;
    }

    inline.innerHTML = renderResult.html ?? "";
    return inline;
  }

  override ignoreEvent(event: Event): boolean {
    return isInlineMathSourceNavigationEvent(event);
  }
}

function focusMarkdownInlineMathSource(view: EditorView, expressionFrom: number, expressionTo: number): void {
  if (
    expressionFrom < 0 ||
    expressionTo > view.state.doc.length ||
    expressionFrom > expressionTo
  ) {
    return;
  }

  view.dispatch({
    selection: { anchor: expressionFrom, head: expressionTo },
    scrollIntoView: true
  });
  view.focus();
}

function isInlineMathSourceNavigationEvent(event: Event): boolean {
  return event.target instanceof Element && Boolean(event.target.closest("[data-inline-math-source='true']"));
}

class MarkdownInlineRendererWidget extends WidgetType {
  private disposed = false;

  constructor(
    private readonly inline: MarkdownInlineRendererRange,
    private readonly sourceFrom: number,
    private readonly sourceTo: number,
    private readonly valueFrom: number,
    private readonly valueTo: number,
    private readonly renderer: MarkdownInlineRenderer
  ) {
    super();
  }

  override eq(widget: WidgetType): boolean {
    return widget instanceof MarkdownInlineRendererWidget &&
      widget.inline.language === this.inline.language &&
      widget.inline.source === this.inline.source &&
      widget.inline.value === this.inline.value &&
      widget.sourceFrom === this.sourceFrom &&
      widget.sourceTo === this.sourceTo &&
      widget.valueFrom === this.valueFrom &&
      widget.valueTo === this.valueTo &&
      widget.renderer === this.renderer;
  }

  override toDOM(view: EditorView): HTMLElement {
    this.disposed = false;
    const inline = document.createElement("span");
    inline.className = "tp-editor-inline-renderer-preview tp-editor-inline-renderer-loading";
    inline.dataset.inlineRendererSource = "true";
    inline.setAttribute("aria-label", `${this.inline.language} inline preview`);
    inline.title = "Edit inline renderer source";
    inline.textContent = this.inline.value;
    inline.addEventListener("mousedown", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    inline.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      focusMarkdownInlineRendererSource(view, this.valueFrom, this.valueTo, this.sourceFrom, this.sourceTo);
    });

    void this.renderExternalPreview(inline, view);
    return inline;
  }

  override destroy(): void {
    this.disposed = true;
  }

  override ignoreEvent(event: Event): boolean {
    return isInlineRendererSourceNavigationEvent(event);
  }

  private async renderExternalPreview(inline: HTMLElement, view: EditorView): Promise<void> {
    try {
      const result = await this.renderer.render({
        language: this.inline.language,
        value: this.inline.value
      });

      if (this.disposed) {
        return;
      }

      if (!result) {
        renderInlineRendererFallback(inline, this.inline.value);
        view.requestMeasure();
        return;
      }

      renderSanitizedMarkdownInlineRendererHtml(inline, result.html, this.inline.value);
      inline.classList.remove("tp-editor-inline-renderer-loading", "tp-editor-inline-renderer-error");
      inline.classList.add("tp-editor-inline-renderer-ready");
      view.requestMeasure();
    } catch (error) {
      if (this.disposed) {
        return;
      }

      inline.classList.remove("tp-editor-inline-renderer-loading", "tp-editor-inline-renderer-ready");
      inline.classList.add("tp-editor-inline-renderer-error");
      inline.textContent = this.inline.value;
      inline.title = `Renderer unavailable: ${readRendererErrorMessage(error)}`;
      view.requestMeasure();
    }
  }
}

function renderInlineRendererFallback(inline: HTMLElement, value: string): void {
  inline.classList.remove("tp-editor-inline-renderer-loading", "tp-editor-inline-renderer-error");
  inline.classList.add("tp-editor-inline-renderer-fallback");
  inline.textContent = value;
}

function renderSanitizedMarkdownInlineRendererHtml(
  inline: HTMLElement,
  html: string,
  fallback: string
): void {
  const fragment = sanitizeMarkdownInlineRendererHtml(html);

  inline.textContent = "";

  if (fragment.childNodes.length === 0) {
    inline.textContent = fallback;
    inline.classList.add("tp-editor-inline-renderer-fallback");
    return;
  }

  inline.append(fragment);
}

function focusMarkdownInlineRendererSource(
  view: EditorView,
  valueFrom: number,
  valueTo: number,
  sourceFrom: number,
  sourceTo: number
): void {
  const from = valueFrom < valueTo ? valueFrom : sourceFrom;
  const to = valueFrom < valueTo ? valueTo : sourceTo;

  if (from < 0 || to > view.state.doc.length || from >= to) {
    return;
  }

  view.dispatch({
    selection: { anchor: from, head: to },
    scrollIntoView: true
  });
  view.focus();
}

function isInlineRendererSourceNavigationEvent(event: Event): boolean {
  return event.target instanceof Element && Boolean(event.target.closest("[data-inline-renderer-source='true']"));
}

function readMathPreviewLabel(status: MarkdownMathRenderStatus): string {
  if (status === "empty") {
    return "Empty TeX";
  }

  if (status === "error") {
    return "TeX error";
  }

  return "TeX";
}

function readMathRenderErrorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "Unable to render expression";
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
    ".tp-editor-code-toolbar": {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "10px",
      width: "100%",
      minHeight: "28px",
      boxSizing: "border-box",
      fontFamily: "var(--tp-font-ui)",
      fontSize: "12px",
      lineHeight: "1",
      color: "var(--tp-color-text-muted)"
    },
    ".tp-editor-code-language": {
      minWidth: "0",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      fontWeight: "650",
      letterSpacing: "0"
    },
    ".tp-editor-preview-copy": {
      flex: "0 0 auto",
      minWidth: `${previewCopyButtonMinWidthPx}px`,
      height: `${previewCopyButtonHeightPx}px`,
      padding: "0 8px",
      border: "1px solid var(--tp-color-code-block-border)",
      borderRadius: "6px",
      backgroundColor: "var(--tp-color-code-toolbar)",
      color: "var(--tp-color-text-muted)",
      font: "inherit",
      fontWeight: "650",
      letterSpacing: "0",
      cursor: "pointer",
      transition: "background-color var(--tp-motion-fast) ease, color var(--tp-motion-fast) ease"
    },
    ".tp-editor-preview-copy:hover, .tp-editor-preview-copy[data-copied='true']": {
      color: "var(--tp-color-accent-strong)",
      backgroundColor: "var(--tp-color-surface-raised)"
    },
    ".tp-editor-renderer-block": {
      display: "flex",
      flexDirection: "column",
      alignItems: "stretch",
      width: "100%",
      minWidth: "0",
      minHeight: `${externalRendererEstimatedMinHeightPx}px`,
      boxSizing: "border-box",
      overflow: "hidden",
      border: "1px solid var(--tp-color-code-block-border)",
      borderLeft: "3px solid var(--tp-color-code-block-border)",
      borderRadius: "var(--tp-radius-control)",
      backgroundColor: "var(--tp-color-code-block)",
      color: "var(--tp-color-text)",
      fontFamily: "var(--tp-font-ui)"
    },
    ".tp-editor-renderer-toolbar": {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "10px",
      width: "100%",
      minWidth: "0",
      minHeight: "36px",
      boxSizing: "border-box",
      padding: "6px 8px",
      borderBottom: "1px solid var(--tp-color-code-block-border)",
      backgroundColor: "var(--tp-color-code-toolbar)",
      color: "var(--tp-color-text-muted)",
      fontSize: "12px",
      lineHeight: "1"
    },
    ".tp-editor-renderer-label": {
      minWidth: "0",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      fontWeight: "650",
      letterSpacing: "0"
    },
    ".tp-editor-renderer-body": {
      display: "block",
      width: "100%",
      minWidth: "0",
      minHeight: "52px",
      boxSizing: "border-box",
      padding: "12px",
      overflow: "auto",
      cursor: "text"
    },
    ".tp-editor-renderer-placeholder": {
      color: "var(--tp-color-text-muted)",
      fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
      fontSize: "13px",
      lineHeight: "1.45"
    },
    ".tp-editor-renderer-html": {
      color: "var(--tp-color-text)",
      fontSize: "14px",
      lineHeight: "1.5"
    },
    ".tp-editor-renderer-html p, .tp-editor-renderer-html ul, .tp-editor-renderer-html ol, .tp-editor-renderer-html pre, .tp-editor-renderer-html table, .tp-editor-renderer-html figure": {
      margin: "0 0 10px"
    },
    ".tp-editor-renderer-html p:last-child, .tp-editor-renderer-html ul:last-child, .tp-editor-renderer-html ol:last-child, .tp-editor-renderer-html pre:last-child, .tp-editor-renderer-html table:last-child, .tp-editor-renderer-html figure:last-child": {
      marginBottom: "0"
    },
    ".tp-editor-renderer-html pre, .tp-editor-renderer-source pre": {
      maxWidth: "100%",
      margin: "0",
      overflow: "auto",
      whiteSpace: "pre",
      fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
      fontSize: "13px",
      lineHeight: "1.45"
    },
    ".tp-editor-renderer-html code, .tp-editor-renderer-source code": {
      fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace"
    },
    ".tp-editor-renderer-html img": {
      display: "block",
      maxWidth: "100%",
      height: "auto"
    },
    ".tp-editor-renderer-html .tp-renderer-mermaid": {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "8px"
    },
    ".tp-editor-renderer-html .tp-renderer-mermaid-image": {
      width: "auto",
      height: "auto",
      maxWidth: "100%",
      maxHeight: "420px",
      objectFit: "contain"
    },
    ".tp-editor-renderer-html .tp-renderer-mermaid-label": {
      width: "100%",
      overflow: "hidden",
      color: "var(--tp-color-text-muted)",
      fontSize: "12px",
      lineHeight: "1.3",
      textAlign: "center",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    },
    ".tp-editor-renderer-html table": {
      width: "100%",
      minWidth: "320px",
      borderCollapse: "collapse",
      tableLayout: "auto"
    },
    ".tp-editor-renderer-html th, .tp-editor-renderer-html td": {
      padding: "7px 9px",
      border: "1px solid var(--tp-color-table-border)",
      textAlign: "left",
      verticalAlign: "top"
    },
    ".tp-editor-renderer-html th": {
      backgroundColor: "var(--tp-color-table-header)",
      fontWeight: "650"
    },
    ".tp-editor-renderer-error": {
      borderColor: "var(--tp-color-danger)"
    },
    ".tp-editor-renderer-error .tp-editor-renderer-toolbar": {
      borderBottomColor: "var(--tp-color-danger)"
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
    ".tp-editor-table-preview": {
      display: "flex",
      flexDirection: "column",
      width: "100%",
      maxWidth: "100%",
      minWidth: "0",
      boxSizing: "border-box",
      contain: "inline-size",
      overflow: "hidden",
      border: "1px solid var(--tp-color-table-border)",
      borderLeft: "3px solid var(--tp-color-table-border)",
      borderRadius: "var(--tp-radius-control)",
      backgroundColor: "var(--tp-color-table-row)",
      color: "var(--tp-color-text)",
      fontFamily: "var(--tp-font-ui)"
    },
    ".tp-editor-table-toolbar": {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "10px",
      width: "100%",
      minWidth: "0",
      minHeight: `${tablePreviewToolbarEstimatedHeight}px`,
      boxSizing: "border-box",
      padding: "6px 8px",
      borderBottom: "1px solid var(--tp-color-table-border)",
      backgroundColor: "var(--tp-color-table-header)",
      color: "var(--tp-color-text-muted)",
      fontSize: "12px",
      lineHeight: "1"
    },
    ".tp-editor-table-label": {
      minWidth: "0",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      fontWeight: "650",
      letterSpacing: "0"
    },
    ".tp-editor-table-actions": {
      display: "flex",
      alignItems: "center",
      gap: "6px",
      flex: "0 1 auto",
      flexWrap: "wrap",
      justifyContent: "flex-end",
      minWidth: "0"
    },
    ".tp-editor-table-tool": {
      minWidth: `${tableToolButtonMinWidthPx}px`,
      height: `${tableToolButtonHeightPx}px`,
      padding: "0 8px",
      boxSizing: "border-box",
      border: "1px solid var(--tp-color-table-border)",
      borderRadius: "6px",
      backgroundColor: "var(--tp-color-surface-raised)",
      color: "var(--tp-color-text-muted)",
      font: "inherit",
      fontWeight: "650",
      letterSpacing: "0",
      cursor: "pointer",
      transition: "background-color var(--tp-motion-fast) ease, color var(--tp-motion-fast) ease"
    },
    ".tp-editor-table-tool:hover": {
      color: "var(--tp-color-accent-strong)",
      backgroundColor: "var(--tp-color-surface)"
    },
    ".tp-editor-table-tool:disabled, .tp-editor-table-tool:disabled:hover": {
      color: "var(--tp-color-text-subtle)",
      backgroundColor: "var(--tp-color-table-row)",
      cursor: "default",
      opacity: "0.72"
    },
    ".tp-editor-table-scroll": {
      display: "block",
      width: "100%",
      minWidth: "0",
      overflowX: "auto"
    },
    ".tp-editor-table-preview table": {
      width: "100%",
      minWidth: "100%",
      borderCollapse: "collapse",
      tableLayout: "auto"
    },
    ".tp-editor-table-preview th, .tp-editor-table-preview td": {
      minWidth: `${tablePreviewCellMinWidthPx}px`,
      maxWidth: `${tablePreviewCellMaxWidthPx}px`,
      padding: "8px 10px",
      borderBottom: "1px solid var(--tp-color-table-border)",
      borderRight: "1px solid var(--tp-color-table-border)",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      fontSize: "13px",
      lineHeight: "1.35",
      textAlign: "left"
    },
    ".tp-editor-table-source-cell": {
      cursor: "text"
    },
    ".tp-editor-table-source-cell:hover": {
      backgroundColor: "var(--tp-color-surface)"
    },
    ".tp-editor-table-preview th": {
      backgroundColor: "var(--tp-color-table-header)",
      fontWeight: "650"
    },
    ".tp-editor-table-header-content": {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "6px",
      minWidth: "0"
    },
    ".tp-editor-table-header-controls": {
      display: "flex",
      alignItems: "center",
      gap: "4px",
      flex: "0 0 auto"
    },
    ".tp-editor-table-header-label": {
      minWidth: "0",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      textAlign: "inherit"
    },
    ".tp-editor-table-cell-content": {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "8px",
      minWidth: "0"
    },
    ".tp-editor-table-cell-controls": {
      display: "flex",
      alignItems: "center",
      gap: "4px",
      flex: "0 0 auto"
    },
    ".tp-editor-table-cell-label": {
      minWidth: "0",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      textAlign: "inherit"
    },
    ".tp-editor-table-align": {
      flex: "0 0 auto",
      minWidth: `${tableAlignmentButtonMinWidthPx}px`,
      height: `${tableAlignmentButtonHeightPx}px`,
      padding: "0 6px",
      border: "1px solid var(--tp-color-table-border)",
      borderRadius: "6px",
      backgroundColor: "var(--tp-color-surface-raised)",
      color: "var(--tp-color-text-muted)",
      font: "inherit",
      fontSize: "11px",
      fontWeight: "700",
      lineHeight: "1",
      letterSpacing: "0",
      cursor: "pointer",
      transition: "background-color var(--tp-motion-fast) ease, color var(--tp-motion-fast) ease"
    },
    ".tp-editor-table-align:hover": {
      color: "var(--tp-color-accent-strong)",
      backgroundColor: "var(--tp-color-surface)"
    },
    ".tp-editor-table-inline-tool": {
      flex: "0 0 auto",
      width: `${tableAlignmentButtonHeightPx}px`,
      height: `${tableAlignmentButtonHeightPx}px`,
      padding: "0",
      border: "1px solid var(--tp-color-table-border)",
      borderRadius: "6px",
      backgroundColor: "var(--tp-color-surface-raised)",
      color: "var(--tp-color-text-subtle)",
      font: "inherit",
      fontSize: "13px",
      fontWeight: "700",
      lineHeight: "1",
      letterSpacing: "0",
      cursor: "pointer",
      transition: "background-color var(--tp-motion-fast) ease, color var(--tp-motion-fast) ease"
    },
    ".tp-editor-table-inline-tool:hover": {
      color: "var(--tp-color-accent-strong)",
      backgroundColor: "var(--tp-color-surface)"
    },
    ".tp-editor-table-inline-tool:disabled, .tp-editor-table-inline-tool:disabled:hover": {
      color: "var(--tp-color-text-subtle)",
      backgroundColor: "var(--tp-color-table-row)",
      cursor: "default",
      opacity: "0.72"
    },
    ".tp-editor-table-preview td": {
      color: "var(--tp-color-text-muted)"
    },
    ".tp-editor-table-preview th[data-align='center'], .tp-editor-table-preview td[data-align='center']": {
      textAlign: "center"
    },
    ".tp-editor-table-preview th[data-align='right'], .tp-editor-table-preview td[data-align='right']": {
      textAlign: "right"
    },
    ".tp-editor-table-preview tr:last-child td": {
      borderBottom: "0"
    },
    ".tp-editor-table-preview th:last-child, .tp-editor-table-preview td:last-child": {
      borderRight: "0"
    },
    ".tp-editor-image-line": {
      paddingTop: "4px",
      paddingBottom: "4px"
    },
    ".tp-editor-image-block": {
      display: "grid",
      gridTemplateColumns: "minmax(64px, 136px) minmax(0, 1fr)",
      alignItems: "center",
      gap: "12px",
      width: "100%",
      minHeight: "86px",
      boxSizing: "border-box",
      margin: "0",
      padding: "10px 12px",
      border: "1px solid var(--tp-color-image-block-border)",
      borderLeft: "3px solid var(--tp-color-image-block-border)",
      borderRadius: "var(--tp-radius-control)",
      backgroundColor: "var(--tp-color-image-block)"
    },
    ".tp-editor-image-preview, .tp-editor-image-placeholder": {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minWidth: "0",
      minHeight: "64px",
      overflow: "hidden",
      borderRadius: "6px",
      backgroundColor: "var(--tp-color-image-preview)"
    },
    ".tp-editor-image-preview img": {
      display: "block",
      maxWidth: "100%",
      maxHeight: "180px",
      objectFit: "contain"
    },
    ".tp-editor-image-placeholder": {
      color: "var(--tp-color-text-soft)",
      fontFamily: "var(--tp-font-ui)",
      fontSize: "12px",
      fontWeight: "700",
      letterSpacing: "0"
    },
    ".tp-editor-image-caption": {
      display: "flex",
      flexDirection: "column",
      gap: "4px",
      minWidth: "0",
      color: "var(--tp-color-text-muted)",
      fontFamily: "var(--tp-font-ui)",
      fontSize: "12px",
      lineHeight: "1.35"
    },
    ".tp-editor-image-caption strong, .tp-editor-image-caption span": {
      minWidth: "0",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    },
    ".tp-editor-image-caption strong": {
      color: "var(--tp-color-text)",
      fontSize: "13px",
      fontWeight: "650"
    },
    ".tp-editor-math-block": {
      fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
      backgroundColor: "var(--tp-color-math-block)",
      borderLeft: "3px solid var(--tp-color-math-block-border)",
      paddingLeft: "12px",
      paddingRight: "12px"
    },
    ".tp-editor-math-open": {
      borderTopLeftRadius: "var(--tp-radius-control)",
      borderTopRightRadius: "var(--tp-radius-control)",
      paddingTop: "6px"
    },
    ".tp-editor-math-close": {
      borderBottomLeftRadius: "var(--tp-radius-control)",
      borderBottomRightRadius: "var(--tp-radius-control)",
      paddingBottom: "6px"
    },
    ".tp-editor-math-content": {
      color: "var(--tp-color-text-muted)"
    },
    ".tp-editor-math-preview": {
      display: "flex",
      flexDirection: "column",
      alignItems: "stretch",
      justifyContent: "flex-start",
      gap: "8px",
      minHeight: `${mathPreviewMinHeightPx}px`,
      boxSizing: "border-box",
      overflowX: "auto",
      padding: "12px",
      border: "1px solid var(--tp-color-math-block-border)",
      borderLeft: "3px solid var(--tp-color-math-block-border)",
      borderRadius: "var(--tp-radius-control)",
      backgroundColor: "var(--tp-color-math-block)",
      color: "var(--tp-color-text)"
    },
    ".tp-editor-math-toolbar": {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "10px",
      width: "100%",
      minHeight: `${mathPreviewToolbarMinHeightPx}px`,
      color: "var(--tp-color-text-muted)",
      fontFamily: "var(--tp-font-ui)",
      fontSize: "12px",
      lineHeight: "1"
    },
    ".tp-editor-math-label": {
      minWidth: "0",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      fontWeight: "650",
      letterSpacing: "0"
    },
    ".tp-editor-math-body": {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: "100%",
      minHeight: `${mathPreviewBodyMinHeightPx}px`,
      overflowX: "auto",
      cursor: "text"
    },
    ".tp-editor-math-preview math": {
      maxWidth: "100%"
    },
    ".tp-editor-inline-math-preview": {
      display: "inline-flex",
      alignItems: "center",
      maxWidth: "100%",
      overflowX: "auto",
      verticalAlign: "-0.14em",
      padding: "0 3px",
      borderRadius: "4px",
      backgroundColor: "var(--tp-color-math-inline)",
      color: "var(--tp-color-text)",
      cursor: "text"
    },
    ".tp-editor-inline-math-preview math": {
      maxWidth: "100%"
    },
    ".tp-editor-inline-math-preview-error": {
      color: "var(--tp-color-text-muted)",
      fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
      fontSize: "0.92em"
    },
    ".tp-editor-inline-renderer-preview": {
      display: "inline-flex",
      alignItems: "center",
      maxWidth: "100%",
      minHeight: "1.35em",
      boxSizing: "border-box",
      overflow: "hidden",
      verticalAlign: "-0.12em",
      padding: "0 5px",
      border: "1px solid var(--tp-color-code-block-border)",
      borderRadius: "4px",
      backgroundColor: "var(--tp-color-code-block)",
      color: "var(--tp-color-text)",
      cursor: "text",
      fontFamily: "var(--tp-font-ui)",
      fontSize: "0.9em",
      lineHeight: "1.35"
    },
    ".tp-editor-inline-renderer-loading, .tp-editor-inline-renderer-fallback, .tp-editor-inline-renderer-error": {
      color: "var(--tp-color-text-muted)",
      fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace"
    },
    ".tp-editor-inline-renderer-error": {
      borderColor: "var(--tp-color-danger)"
    },
    ".tp-editor-inline-renderer-preview img": {
      display: "inline-block",
      maxWidth: "1.2em",
      maxHeight: "1.2em",
      objectFit: "contain",
      verticalAlign: "-0.18em"
    },
    ".tp-editor-inline-renderer-preview .tp-renderer-status": {
      display: "inline-flex",
      alignItems: "center",
      gap: "5px",
      maxWidth: "100%",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      fontWeight: "650",
      letterSpacing: "0"
    },
    ".tp-editor-inline-renderer-preview .tp-renderer-status::before": {
      content: "\"\"",
      flex: "0 0 auto",
      width: "6px",
      height: "6px",
      borderRadius: "50%",
      backgroundColor: "currentColor"
    },
    ".tp-editor-inline-renderer-preview .tp-renderer-status-success": {
      color: "var(--tp-color-accent-strong)"
    },
    ".tp-editor-inline-renderer-preview .tp-renderer-status-info": {
      color: "var(--tp-color-accent)"
    },
    ".tp-editor-inline-renderer-preview .tp-renderer-status-warning": {
      color: "var(--tp-color-warning)"
    },
    ".tp-editor-inline-renderer-preview .tp-renderer-status-danger": {
      color: "var(--tp-color-danger)"
    },
    ".tp-editor-inline-renderer-preview .tp-renderer-status-neutral": {
      color: "var(--tp-color-text-muted)"
    },
    ".tp-editor-math-preview-empty, .tp-editor-math-preview-error": {
      justifyContent: "flex-start",
      color: "var(--tp-color-text-muted)",
      fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
      fontSize: "13px"
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

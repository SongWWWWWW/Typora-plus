import {
  EditorSelection,
  Prec,
  type EditorState,
  type Extension
} from "@codemirror/state";
import {
  EditorView,
  keymap,
  ViewPlugin,
  type ViewUpdate
} from "@codemirror/view";

export type MarkdownSlashCommandId =
  | "table"
  | "todo"
  | "callout"
  | "code"
  | "quote"
  | "divider"
  | "date"
  | "meeting";

export interface MarkdownSlashCommandLabels {
  readonly menuLabel: string;
  readonly tableTitle: string;
  readonly tableDescription: string;
  readonly tableColumn1: string;
  readonly tableColumn2: string;
  readonly tableColumn3: string;
  readonly todoTitle: string;
  readonly todoDescription: string;
  readonly todoItem: string;
  readonly calloutTitle: string;
  readonly calloutDescription: string;
  readonly calloutHeading: string;
  readonly calloutBody: string;
  readonly codeTitle: string;
  readonly codeDescription: string;
  readonly codeLanguage: string;
  readonly codeBody: string;
  readonly quoteTitle: string;
  readonly quoteDescription: string;
  readonly quoteBody: string;
  readonly dividerTitle: string;
  readonly dividerDescription: string;
  readonly dateTitle: string;
  readonly dateDescription: string;
  readonly meetingTitle: string;
  readonly meetingDescription: string;
  readonly meetingHeading: string;
  readonly meetingDate: string;
  readonly meetingAttendees: string;
  readonly meetingAgenda: string;
  readonly meetingAgendaItem: string;
  readonly meetingNotes: string;
  readonly meetingNoteItem: string;
  readonly meetingActions: string;
  readonly meetingActionItem: string;
}

export type MarkdownSlashCommandLabelOverrides = Partial<MarkdownSlashCommandLabels>;

export interface MarkdownSlashCommandDescriptor {
  readonly id: MarkdownSlashCommandId;
  readonly aliases: readonly string[];
  readonly description: string;
  readonly title: string;
}

export interface MarkdownSlashCommandMatch {
  readonly from: number;
  readonly query: string;
  readonly to: number;
}

export interface MarkdownSlashCommandSelection {
  readonly anchor: number;
  readonly head: number;
}

export interface MarkdownSlashCommandInsertion {
  readonly selection: MarkdownSlashCommandSelection;
  readonly text: string;
}

export interface MarkdownSlashCommandInsertionOptions {
  readonly now?: Date;
}

export const defaultMarkdownSlashCommandLabels: MarkdownSlashCommandLabels = {
  menuLabel: "Insert block",
  tableTitle: "Table",
  tableDescription: "Insert a simple three-column table",
  tableColumn1: "Column 1",
  tableColumn2: "Column 2",
  tableColumn3: "Column 3",
  todoTitle: "Task List",
  todoDescription: "Insert a checklist",
  todoItem: "Task",
  calloutTitle: "Callout",
  calloutDescription: "Insert a highlighted note block",
  calloutHeading: "Note",
  calloutBody: "Write a note...",
  codeTitle: "Code Block",
  codeDescription: "Insert a fenced code block",
  codeLanguage: "text",
  codeBody: "code",
  quoteTitle: "Quote",
  quoteDescription: "Insert a blockquote",
  quoteBody: "Quote",
  dividerTitle: "Divider",
  dividerDescription: "Insert a horizontal rule",
  dateTitle: "Date",
  dateDescription: "Insert today's date",
  meetingTitle: "Meeting Notes",
  meetingDescription: "Insert agenda, notes, and action items",
  meetingHeading: "Meeting Notes",
  meetingDate: "Date",
  meetingAttendees: "Attendees",
  meetingAgenda: "Agenda",
  meetingAgendaItem: "Topic",
  meetingNotes: "Notes",
  meetingNoteItem: "Decision or note",
  meetingActions: "Action Items",
  meetingActionItem: "Owner - next step"
};

const slashCommandIds: readonly MarkdownSlashCommandId[] = [
  "table",
  "todo",
  "meeting",
  "callout",
  "code",
  "quote",
  "divider",
  "date"
];

const slashCommandAliases: Readonly<Record<MarkdownSlashCommandId, readonly string[]>> = {
  table: ["tb", "grid", "sheet", "表格"],
  todo: ["task", "tasks", "checklist", "待办", "任务"],
  callout: ["note", "info", "admonition", "提示", "标注"],
  code: ["fence", "snippet", "代码"],
  quote: ["blockquote", "引用"],
  divider: ["hr", "line", "rule", "分割线"],
  date: ["today", "day", "日期", "今天"],
  meeting: ["meeting-notes", "minutes", "agenda", "会议", "会议纪要"]
};

export function markdownSlashCommandExtension(
  labelOverrides: MarkdownSlashCommandLabelOverrides | undefined
): Extension {
  const labels = resolveMarkdownSlashCommandLabels(labelOverrides);
  const plugin = ViewPlugin.fromClass(
    class MarkdownSlashCommandView {
      private activeIndex = 0;
      private dismissedKey: string | undefined;
      private items: readonly MarkdownSlashCommandDescriptor[] = [];
      private match: MarkdownSlashCommandMatch | undefined;
      private menu: HTMLElement | undefined;

      constructor(private readonly view: EditorView) {
        this.updateMenu();
      }

      update(update: ViewUpdate): void {
        if (update.docChanged || update.selectionSet || update.viewportChanged || update.focusChanged) {
          this.updateMenu();
        }
      }

      destroy(): void {
        this.removeMenu();
      }

      acceptActive(): boolean {
        const match = this.match;
        const item = this.items[this.activeIndex];

        if (!match || !item) {
          return false;
        }

        const insertion = createMarkdownSlashCommandInsertion(item.id, labels, { now: new Date() });
        this.view.dispatch({
          changes: { from: match.from, to: match.to, insert: insertion.text },
          selection: EditorSelection.single(
            match.from + insertion.selection.anchor,
            match.from + insertion.selection.head
          ),
          scrollIntoView: true
        });
        this.view.focus();

        return true;
      }

      close(): boolean {
        if (!this.match) {
          return false;
        }

        this.dismissedKey = slashCommandMatchKey(this.match);
        this.removeMenu();

        return true;
      }

      moveActive(delta: number): boolean {
        if (!this.match || this.items.length === 0) {
          return false;
        }

        this.activeIndex = wrapIndex(this.activeIndex + delta, this.items.length);
        this.renderMenu();

        return true;
      }

      private updateMenu(): void {
        const nextMatch = readMarkdownSlashCommandMatch(this.view.state);

        if (!nextMatch || this.dismissedKey === slashCommandMatchKey(nextMatch)) {
          this.match = nextMatch;
          this.items = [];
          this.activeIndex = 0;
          this.removeMenu();
          return;
        }

        const nextItems = filterMarkdownSlashCommands(nextMatch.query, labels);
        const previousKey = this.match ? slashCommandMatchKey(this.match) : undefined;
        const nextKey = slashCommandMatchKey(nextMatch);

        this.match = nextMatch;
        this.items = nextItems;

        if (previousKey !== nextKey) {
          this.activeIndex = 0;
        } else {
          this.activeIndex = clamp(this.activeIndex, 0, Math.max(0, nextItems.length - 1));
        }

        if (nextItems.length === 0) {
          this.removeMenu();
          return;
        }

        this.renderMenu();
      }

      private renderMenu(): void {
        const match = this.match;

        if (!match || this.items.length === 0) {
          this.removeMenu();
          return;
        }

        const menu = this.ensureMenu();
        menu.textContent = "";
        menu.setAttribute("aria-label", labels.menuLabel);

        for (const [index, item] of this.items.entries()) {
          const option = document.createElement("button");
          option.type = "button";
          option.className = index === this.activeIndex
            ? "tp-editor-slash-command-row tp-editor-slash-command-row-active"
            : "tp-editor-slash-command-row";
          option.setAttribute("role", "option");
          option.setAttribute("aria-selected", String(index === this.activeIndex));
          option.addEventListener("mouseenter", () => {
            this.activeIndex = index;
            this.renderMenu();
          });
          option.addEventListener("mousedown", (event) => {
            event.preventDefault();
            this.activeIndex = index;
            this.acceptActive();
          });

          const title = document.createElement("span");
          title.className = "tp-editor-slash-command-title";
          title.textContent = item.title;

          const description = document.createElement("small");
          description.className = "tp-editor-slash-command-description";
          description.textContent = item.description;

          option.append(title, description);
          menu.append(option);
        }

        this.positionMenu(menu, match);
      }

      private ensureMenu(): HTMLElement {
        if (this.menu) {
          return this.menu;
        }

        const menu = document.createElement("div");
        menu.className = "tp-editor-slash-command-menu";
        menu.setAttribute("role", "listbox");
        this.view.dom.append(menu);
        this.menu = menu;

        return menu;
      }

      private removeMenu(): void {
        this.menu?.remove();
        this.menu = undefined;
      }

      private positionMenu(menu: HTMLElement, match: MarkdownSlashCommandMatch): void {
        const coords = readEditorCoordinates(this.view, match);
        const editorRect = this.view.dom.getBoundingClientRect();
        const fallbackLeft = 14;
        const fallbackTop = 30;

        if (!coords) {
          menu.style.left = `${fallbackLeft}px`;
          menu.style.top = `${fallbackTop}px`;
          return;
        }

        const maxLeft = Math.max(fallbackLeft, editorRect.width - 288);
        const left = clamp(coords.left - editorRect.left, fallbackLeft, maxLeft);
        const top = Math.max(fallbackTop, coords.bottom - editorRect.top + 6);

        menu.style.left = `${left}px`;
        menu.style.top = `${top}px`;
      }
    }
  );

  return [
    plugin,
    slashCommandTheme(),
    Prec.highest(keymap.of([
      { key: "ArrowDown", run: (view) => view.plugin(plugin)?.moveActive(1) ?? false },
      { key: "ArrowUp", run: (view) => view.plugin(plugin)?.moveActive(-1) ?? false },
      { key: "Enter", run: (view) => view.plugin(plugin)?.acceptActive() ?? false },
      { key: "Tab", run: (view) => view.plugin(plugin)?.acceptActive() ?? false },
      { key: "Escape", run: (view) => view.plugin(plugin)?.close() ?? false }
    ]))
  ];
}

export function resolveMarkdownSlashCommandLabels(
  overrides: MarkdownSlashCommandLabelOverrides | undefined
): MarkdownSlashCommandLabels {
  return overrides ? { ...defaultMarkdownSlashCommandLabels, ...overrides } : defaultMarkdownSlashCommandLabels;
}

export function createMarkdownSlashCommandDescriptors(
  labels: MarkdownSlashCommandLabels
): readonly MarkdownSlashCommandDescriptor[] {
  return slashCommandIds.map((id) => ({
    id,
    aliases: slashCommandAliases[id],
    title: slashCommandTitle(id, labels),
    description: slashCommandDescription(id, labels)
  }));
}

export function filterMarkdownSlashCommands(
  query: string,
  labels: MarkdownSlashCommandLabels = defaultMarkdownSlashCommandLabels
): readonly MarkdownSlashCommandDescriptor[] {
  const normalizedQuery = normalizeSearchText(query);
  const commands = createMarkdownSlashCommandDescriptors(labels);

  if (!normalizedQuery) {
    return commands;
  }

  return commands.filter((command) => {
    const searchable = [
      command.id,
      command.title,
      command.description,
      ...command.aliases
    ].map(normalizeSearchText);

    return searchable.some((value) => value.includes(normalizedQuery));
  });
}

export function readMarkdownSlashCommandMatch(state: EditorState): MarkdownSlashCommandMatch | undefined {
  if (state.selection.ranges.length !== 1) {
    return undefined;
  }

  const range = state.selection.main;

  if (!range.empty) {
    return undefined;
  }

  const line = state.doc.lineAt(range.head);
  const textBeforeCursor = line.text.slice(0, range.head - line.from);
  const match = /^(\s*)\/([\p{L}\p{N}_-]*)$/u.exec(textBeforeCursor);

  if (!match) {
    return undefined;
  }

  return {
    from: line.from,
    to: range.head,
    query: match[2] ?? ""
  };
}

export function createMarkdownSlashCommandInsertion(
  id: MarkdownSlashCommandId,
  labels: MarkdownSlashCommandLabels = defaultMarkdownSlashCommandLabels,
  options: MarkdownSlashCommandInsertionOptions = {}
): MarkdownSlashCommandInsertion {
  switch (id) {
    case "table":
      return selectFirstPlaceholder([
        `| ${labels.tableColumn1} | ${labels.tableColumn2} | ${labels.tableColumn3} |`,
        "| --- | --- | --- |",
        "|  |  |  |",
        "|  |  |  |"
      ].join("\n"), labels.tableColumn1);
    case "todo":
      return selectFirstPlaceholder([
        `- [ ] ${labels.todoItem}`,
        `- [ ] ${labels.todoItem}`,
        `- [ ] ${labels.todoItem}`
      ].join("\n"), labels.todoItem);
    case "callout":
      return selectFirstPlaceholder([
        `> [!NOTE] ${labels.calloutHeading}`,
        `> ${labels.calloutBody}`
      ].join("\n"), labels.calloutHeading);
    case "code":
      return selectFirstPlaceholder([
        `\`\`\`${labels.codeLanguage}`,
        labels.codeBody,
        "```"
      ].join("\n"), labels.codeLanguage);
    case "quote":
      return selectFirstPlaceholder(`> ${labels.quoteBody}`, labels.quoteBody);
    case "divider":
      return cursorAtEnd("---");
    case "date":
      return cursorAtEnd(formatMarkdownSlashCommandDate(options.now ?? new Date()));
    case "meeting": {
      const text = [
        `## ${labels.meetingHeading}`,
        "",
        `- ${labels.meetingDate}: ${formatMarkdownSlashCommandDate(options.now ?? new Date())}`,
        `- ${labels.meetingAttendees}: `,
        "",
        `### ${labels.meetingAgenda}`,
        "",
        `- ${labels.meetingAgendaItem}`,
        "",
        `### ${labels.meetingNotes}`,
        "",
        `- ${labels.meetingNoteItem}`,
        "",
        `### ${labels.meetingActions}`,
        "",
        `- [ ] ${labels.meetingActionItem}`
      ].join("\n");

      return selectFirstPlaceholder(text, labels.meetingHeading);
    }
  }
}

export function formatMarkdownSlashCommandDate(date: Date): string {
  return [
    date.getFullYear(),
    padDatePart(date.getMonth() + 1),
    padDatePart(date.getDate())
  ].join("-");
}

function slashCommandTitle(id: MarkdownSlashCommandId, labels: MarkdownSlashCommandLabels): string {
  switch (id) {
    case "table":
      return labels.tableTitle;
    case "todo":
      return labels.todoTitle;
    case "callout":
      return labels.calloutTitle;
    case "code":
      return labels.codeTitle;
    case "quote":
      return labels.quoteTitle;
    case "divider":
      return labels.dividerTitle;
    case "date":
      return labels.dateTitle;
    case "meeting":
      return labels.meetingTitle;
  }
}

function slashCommandDescription(id: MarkdownSlashCommandId, labels: MarkdownSlashCommandLabels): string {
  switch (id) {
    case "table":
      return labels.tableDescription;
    case "todo":
      return labels.todoDescription;
    case "callout":
      return labels.calloutDescription;
    case "code":
      return labels.codeDescription;
    case "quote":
      return labels.quoteDescription;
    case "divider":
      return labels.dividerDescription;
    case "date":
      return labels.dateDescription;
    case "meeting":
      return labels.meetingDescription;
  }
}

function selectFirstPlaceholder(text: string, placeholder: string): MarkdownSlashCommandInsertion {
  const index = text.indexOf(placeholder);

  if (index < 0) {
    return cursorAtEnd(text);
  }

  return {
    text,
    selection: {
      anchor: index,
      head: index + placeholder.length
    }
  };
}

function cursorAtEnd(text: string): MarkdownSlashCommandInsertion {
  return {
    text,
    selection: {
      anchor: text.length,
      head: text.length
    }
  };
}

function normalizeSearchText(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function slashCommandMatchKey(match: MarkdownSlashCommandMatch): string {
  return `${match.from}:${match.to}:${match.query}`;
}

function wrapIndex(index: number, size: number): number {
  return ((index % size) + size) % size;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function padDatePart(value: number): string {
  return value.toString().padStart(2, "0");
}

function readEditorCoordinates(
  view: EditorView,
  match: MarkdownSlashCommandMatch
): { readonly bottom: number; readonly left: number } | null {
  try {
    return view.coordsAtPos(match.to) ?? view.coordsAtPos(match.from);
  } catch {
    return null;
  }
}

function slashCommandTheme(): Extension {
  return EditorView.theme({
    "&": {
      position: "relative"
    },
    ".tp-editor-slash-command-menu": {
      position: "absolute",
      zIndex: "35",
      display: "flex",
      flexDirection: "column",
      gap: "2px",
      width: "min(280px, calc(100% - 16px))",
      boxSizing: "border-box",
      padding: "4px",
      overflow: "hidden",
      border: "1px solid var(--tp-color-border)",
      borderRadius: "var(--tp-radius-control)",
      backgroundColor: "var(--tp-color-surface-raised)",
      boxShadow: "0 12px 30px var(--tp-color-shadow)",
      color: "var(--tp-color-text)",
      fontFamily: "var(--tp-font-ui)"
    },
    ".tp-editor-slash-command-row": {
      display: "grid",
      gridTemplateColumns: "minmax(0, 1fr)",
      gap: "2px",
      width: "100%",
      minWidth: "0",
      minHeight: "38px",
      boxSizing: "border-box",
      padding: "5px 7px",
      overflow: "hidden",
      border: "1px solid transparent",
      borderRadius: "var(--tp-radius-control)",
      backgroundColor: "transparent",
      color: "var(--tp-color-text-muted)",
      cursor: "pointer",
      font: "inherit",
      textAlign: "left"
    },
    ".tp-editor-slash-command-row:hover, .tp-editor-slash-command-row-active": {
      borderColor: "color-mix(in srgb, var(--tp-color-border) 72%, transparent)",
      backgroundColor: "var(--tp-color-surface-muted)",
      color: "var(--tp-color-text)"
    },
    ".tp-editor-slash-command-title, .tp-editor-slash-command-description": {
      minWidth: "0",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    },
    ".tp-editor-slash-command-title": {
      color: "var(--tp-color-text)",
      fontSize: "13px",
      fontWeight: "700",
      lineHeight: "1.2"
    },
    ".tp-editor-slash-command-description": {
      color: "var(--tp-color-text-soft)",
      fontSize: "11px",
      lineHeight: "1.25"
    }
  });
}

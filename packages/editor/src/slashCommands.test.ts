import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import {
  createMarkdownSlashCommandInsertion,
  defaultMarkdownSlashCommandLabels,
  filterMarkdownSlashCommands,
  formatMarkdownSlashCommandDate,
  markdownSlashCommandExtension,
  readMarkdownSlashCommandMatch
} from "./index";

describe("readMarkdownSlashCommandMatch", () => {
  it("matches slash commands typed at the start of the current line", () => {
    const state = EditorState.create({
      doc: "/table",
      selection: { anchor: "/table".length }
    });

    expect(readMarkdownSlashCommandMatch(state)).toEqual({
      from: 0,
      to: "/table".length,
      query: "table"
    });
  });

  it("ignores slash text in the middle of a paragraph", () => {
    const state = EditorState.create({
      doc: "Open /table",
      selection: { anchor: "Open /table".length }
    });

    expect(readMarkdownSlashCommandMatch(state)).toBeUndefined();
  });
});

describe("filterMarkdownSlashCommands", () => {
  it("filters commands by id, title, description, and aliases", () => {
    expect(filterMarkdownSlashCommands("grid").map((command) => command.id)).toEqual(["table"]);
    expect(filterMarkdownSlashCommands("meeting").map((command) => command.id)).toEqual(["meeting"]);
  });
});

describe("createMarkdownSlashCommandInsertion", () => {
  it("creates a table template with the first heading selected", () => {
    const insertion = createMarkdownSlashCommandInsertion("table");

    expect(insertion.text).toContain("| Column 1 | Column 2 | Column 3 |");
    expect(insertion.selection).toEqual({
      anchor: insertion.text.indexOf("Column 1"),
      head: insertion.text.indexOf("Column 1") + "Column 1".length
    });
  });

  it("creates stable local-date text for date commands", () => {
    expect(formatMarkdownSlashCommandDate(new Date(2026, 5, 15))).toBe("2026-06-15");
    expect(createMarkdownSlashCommandInsertion("date", defaultMarkdownSlashCommandLabels, {
      now: new Date(2026, 5, 15)
    }).text).toBe("2026-06-15");
  });
});

describe("markdownSlashCommandExtension", () => {
  it("inserts the active slash command with Enter", () => {
    withDom(() => {
      const view = createSlashCommandView("/table");

      expect(document.querySelector(".tp-editor-slash-command-menu")).not.toBeNull();

      view.contentDOM.dispatchEvent(new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: "Enter"
      }));

      expect(view.state.doc.toString()).toContain("| Column 1 | Column 2 | Column 3 |");
      expect(document.querySelector(".tp-editor-slash-command-menu")).toBeNull();
      view.destroy();
    });
  });

  it("closes the slash command menu with Escape without changing text", () => {
    withDom(() => {
      const view = createSlashCommandView("/todo");

      expect(document.querySelector(".tp-editor-slash-command-menu")).not.toBeNull();

      view.contentDOM.dispatchEvent(new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: "Escape"
      }));

      expect(view.state.doc.toString()).toBe("/todo");
      expect(document.querySelector(".tp-editor-slash-command-menu")).toBeNull();
      view.destroy();
    });
  });
});

function createSlashCommandView(doc: string): EditorView {
  const parent = document.createElement("div");
  document.body.append(parent);

  return new EditorView({
    parent,
    state: EditorState.create({
      doc,
      selection: { anchor: doc.length },
      extensions: [markdownSlashCommandExtension(undefined)]
    })
  });
}

function withDom<T>(run: () => T): T {
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  dom.window.requestAnimationFrame = (callback) => Number(setTimeout(() => callback(Date.now()), 0));
  dom.window.cancelAnimationFrame = (handle) => clearTimeout(handle);
  const previousWindow = Reflect.get(globalThis, "window");
  const previousDocument = Reflect.get(globalThis, "document");
  const previousNode = Reflect.get(globalThis, "Node");
  const previousElement = Reflect.get(globalThis, "Element");
  const previousHTMLElement = Reflect.get(globalThis, "HTMLElement");
  const previousMutationObserver = Reflect.get(globalThis, "MutationObserver");
  const previousKeyboardEvent = Reflect.get(globalThis, "KeyboardEvent");
  const previousRequestAnimationFrame = Reflect.get(globalThis, "requestAnimationFrame");
  const previousCancelAnimationFrame = Reflect.get(globalThis, "cancelAnimationFrame");

  setGlobal("window", dom.window);
  setGlobal("document", dom.window.document);
  setGlobal("Node", dom.window.Node);
  setGlobal("Element", dom.window.Element);
  setGlobal("HTMLElement", dom.window.HTMLElement);
  setGlobal("MutationObserver", dom.window.MutationObserver);
  setGlobal("KeyboardEvent", dom.window.KeyboardEvent);
  setGlobal("requestAnimationFrame", dom.window.requestAnimationFrame);
  setGlobal("cancelAnimationFrame", dom.window.cancelAnimationFrame);

  try {
    return run();
  } finally {
    restoreGlobal("window", previousWindow);
    restoreGlobal("document", previousDocument);
    restoreGlobal("Node", previousNode);
    restoreGlobal("Element", previousElement);
    restoreGlobal("HTMLElement", previousHTMLElement);
    restoreGlobal("MutationObserver", previousMutationObserver);
    restoreGlobal("KeyboardEvent", previousKeyboardEvent);
    restoreGlobal("requestAnimationFrame", previousRequestAnimationFrame);
    restoreGlobal("cancelAnimationFrame", previousCancelAnimationFrame);
  }
}

function setGlobal(name: string, value: unknown): void {
  Object.defineProperty(globalThis, name, {
    configurable: true,
    value,
    writable: true
  });
}

function restoreGlobal(name: string, value: unknown): void {
  if (value === undefined) {
    Reflect.deleteProperty(globalThis, name);
    return;
  }

  setGlobal(name, value);
}

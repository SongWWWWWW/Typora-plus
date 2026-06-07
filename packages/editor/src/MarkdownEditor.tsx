import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { bracketMatching, defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { Compartment, EditorState, type Extension, type Line, type SelectionRange } from "@codemirror/state";
import {
  crosshairCursor,
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  keymap,
  placeholder,
  rectangularSelection
} from "@codemirror/view";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import {
  findMarkdownListItemContentStart,
  findMarkdownTaskListMarkerRange,
  livePreviewExtension,
  type MarkdownCodeFenceRenderer,
  type MarkdownEditorConfiguration,
  type MarkdownImageSourceResolver,
  type MarkdownInlineRenderer
} from "./livePreview";

interface MarkdownTaskListLineChange {
  readonly from: number;
  readonly insert: string;
  readonly to: number;
}

export interface PastedEditorImage {
  readonly name: string;
  readonly mimeType: string;
  readonly base64: string;
}

export interface MarkdownEditorHandle {
  focus(): void;
  scrollToLine(line: number): void;
}

export interface MarkdownEditorProps {
  readonly value: string;
  readonly configuration: MarkdownEditorConfiguration;
  readonly onChange: (value: string) => void;
  readonly onPasteImage?: ((image: PastedEditorImage) => Promise<string | undefined>) | undefined;
  readonly resolveImageSource?: MarkdownImageSourceResolver | undefined;
  readonly renderCodeFence?: MarkdownCodeFenceRenderer | undefined;
  readonly renderInline?: MarkdownInlineRenderer | undefined;
}

const editorPlaceholder = " ";

export const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
  ({ value, configuration, onChange, onPasteImage, resolveImageSource, renderCodeFence, renderInline }, ref) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const viewRef = useRef<EditorView | null>(null);
    const onChangeRef = useRef(onChange);
    const onPasteImageRef = useRef(onPasteImage);
    const previewCompartmentRef = useRef(new Compartment());

    useEffect(() => {
      onChangeRef.current = onChange;
    }, [onChange]);

    useEffect(() => {
      onPasteImageRef.current = onPasteImage;
    }, [onPasteImage]);

    useImperativeHandle(ref, () => ({
      focus() {
        viewRef.current?.focus();
      },
      scrollToLine(line: number) {
        const view = viewRef.current;
        if (!view) {
          return;
        }

        const targetLine = Math.max(1, Math.min(line, view.state.doc.lines));
        const docLine = view.state.doc.line(targetLine);
        view.dispatch({
          selection: { anchor: docLine.from },
          effects: EditorView.scrollIntoView(docLine.from, { y: "center" })
        });
        view.focus();
      }
    }));

    useEffect(() => {
      if (!containerRef.current) {
        return;
      }

      const updateListener = EditorView.updateListener.of((update) => {
        if (!update.docChanged) {
          return;
        }

        onChangeRef.current(update.state.doc.toString());
      });

      const state = EditorState.create({
        doc: value,
        extensions: [
          ...baseEditorExtensions(),
          imagePasteExtension(() => onPasteImageRef.current),
          previewCompartmentRef.current.of(
            livePreviewExtension(configuration, resolveImageSource, renderCodeFence, renderInline)
          ),
          updateListener
        ]
      });

      const view = new EditorView({
        state,
        parent: containerRef.current
      });

      viewRef.current = view;

      return () => {
        view.destroy();
        viewRef.current = null;
      };
    }, []);

    useEffect(() => {
      const view = viewRef.current;
      if (!view) {
        return;
      }

      view.dispatch({
        effects: previewCompartmentRef.current.reconfigure(
          livePreviewExtension(configuration, resolveImageSource, renderCodeFence, renderInline)
        )
      });
    }, [configuration, resolveImageSource, renderCodeFence, renderInline]);

    useEffect(() => {
      const view = viewRef.current;
      if (!view || value === view.state.doc.toString()) {
        return;
      }

      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: value
        }
      });
    }, [value]);

    return <div className="tp-markdown-editor" ref={containerRef} />;
  }
);

MarkdownEditor.displayName = "MarkdownEditor";

function baseEditorExtensions(): Extension[] {
  return [
    history(),
    EditorState.allowMultipleSelections.of(true),
    drawSelection(),
    dropCursor(),
    rectangularSelection(),
    crosshairCursor(),
    highlightActiveLine(),
    bracketMatching(),
    highlightSelectionMatches(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    markdown(),
    placeholder(editorPlaceholder),
    EditorView.lineWrapping,
    keymap.of([
      { key: "Mod-Shift-Enter", run: removeMarkdownTaskListMarkersAtSelection },
      { key: "Mod-Enter", run: toggleMarkdownTaskListLineAtSelection },
      ...defaultKeymap,
      ...historyKeymap,
      ...searchKeymap
    ])
  ];
}

export function toggleMarkdownTaskListLineAtSelection(view: EditorView): boolean {
  const changes = getMarkdownTaskListLineToggleChanges(view.state);

  if (changes.length === 0) {
    return false;
  }

  view.dispatch({
    changes
  });

  return true;
}

export function removeMarkdownTaskListMarkersAtSelection(view: EditorView): boolean {
  const changes = getMarkdownTaskListLineRemovalChanges(view.state);

  if (changes.length === 0) {
    return false;
  }

  view.dispatch({
    changes
  });

  return true;
}

function getMarkdownTaskListLineToggleChanges(state: EditorState): readonly MarkdownTaskListLineChange[] {
  const changesByLine = new Map<number, MarkdownTaskListLineChange>();

  for (const range of state.selection.ranges) {
    for (const line of getSelectionLines(state, range)) {
      if (changesByLine.has(line.from)) {
        continue;
      }

      const taskMarker = findMarkdownTaskListMarkerRange(line.text);

      if (!taskMarker) {
        const listContentStart = findMarkdownListItemContentStart(line.text);

        if (listContentStart === undefined) {
          continue;
        }

        changesByLine.set(line.from, {
          from: line.from + listContentStart,
          to: line.from + listContentStart,
          insert: "[ ] "
        });
        continue;
      }

      changesByLine.set(line.from, {
        from: line.from + taskMarker.from,
        to: line.from + taskMarker.to,
        insert: taskMarker.checked ? "[ ]" : "[x]"
      });
    }
  }

  return [...changesByLine.values()].sort((left, right) => left.from - right.from);
}

function getMarkdownTaskListLineRemovalChanges(state: EditorState): readonly MarkdownTaskListLineChange[] {
  const changesByLine = new Map<number, MarkdownTaskListLineChange>();

  for (const range of state.selection.ranges) {
    for (const line of getSelectionLines(state, range)) {
      if (changesByLine.has(line.from)) {
        continue;
      }

      const taskMarker = findMarkdownTaskListMarkerRange(line.text);

      if (!taskMarker) {
        continue;
      }

      changesByLine.set(line.from, {
        from: line.from + taskMarker.from,
        to: line.from + getTaskListMarkerRemovalTo(line.text, taskMarker.to),
        insert: ""
      });
    }
  }

  return [...changesByLine.values()].sort((left, right) => left.from - right.from);
}

function getTaskListMarkerRemovalTo(text: string, markerTo: number): number {
  let to = markerTo;

  while (to < text.length && (text[to] === " " || text[to] === "\t")) {
    to += 1;
  }

  return to;
}

function getSelectionLines(state: EditorState, range: SelectionRange): readonly Line[] {
  if (range.empty) {
    return [state.doc.lineAt(range.head)];
  }

  const fromLine = state.doc.lineAt(range.from);
  const toLine = state.doc.lineAt(Math.max(range.from, range.to - 1));
  const lines: Line[] = [];

  for (let lineNumber = fromLine.number; lineNumber <= toLine.number; lineNumber += 1) {
    lines.push(state.doc.line(lineNumber));
  }

  return lines;
}

function imagePasteExtension(
  resolvePasteImageHandler: () => ((image: PastedEditorImage) => Promise<string | undefined>) | undefined
): Extension {
  return EditorView.domEventHandlers({
    paste(event, view) {
      const onPasteImage = resolvePasteImageHandler();

      if (!onPasteImage) {
        return false;
      }

      const file = firstImageFile(event.clipboardData?.files);

      if (!file) {
        return false;
      }

      event.preventDefault();
      void insertPastedImage(view, file, onPasteImage);
      return true;
    }
  });
}

async function insertPastedImage(
  view: EditorView,
  file: File,
  onPasteImage: (image: PastedEditorImage) => Promise<string | undefined> | undefined
): Promise<void> {
  const markdown = await onPasteImage({
    name: file.name || "image",
    mimeType: file.type || "image/png",
    base64: await fileToBase64(file)
  });

  if (!markdown) {
    return;
  }

  view.dispatch(view.state.replaceSelection(markdown));
  view.focus();
}

function firstImageFile(files: FileList | undefined): File | undefined {
  if (!files) {
    return undefined;
  }

  for (const file of Array.from(files)) {
    if (file.type.startsWith("image/")) {
      return file;
    }
  }

  return undefined;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const result = String(reader.result ?? "");
      resolve(result.includes(",") ? result.split(",").at(1) ?? "" : result);
    });
    reader.addEventListener("error", () => reject(reader.error ?? new Error("Failed to read pasted image")));
    reader.readAsDataURL(file);
  });
}

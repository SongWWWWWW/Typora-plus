import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { bracketMatching, defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { Compartment, EditorState, type Extension } from "@codemirror/state";
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
  livePreviewExtension,
  type MarkdownCodeFenceRenderer,
  type MarkdownEditorConfiguration,
  type MarkdownImageSourceResolver
} from "./livePreview";

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
}

const editorPlaceholder = " ";

export const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
  ({ value, configuration, onChange, onPasteImage, resolveImageSource, renderCodeFence }, ref) => {
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
          previewCompartmentRef.current.of(livePreviewExtension(configuration, resolveImageSource, renderCodeFence)),
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
          livePreviewExtension(configuration, resolveImageSource, renderCodeFence)
        )
      });
    }, [configuration, resolveImageSource, renderCodeFence]);

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
    keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap])
  ];
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

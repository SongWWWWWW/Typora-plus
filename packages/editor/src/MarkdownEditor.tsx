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
import { livePreviewExtension, type MarkdownEditorConfiguration } from "./livePreview";

export interface MarkdownEditorHandle {
  focus(): void;
  scrollToLine(line: number): void;
}

export interface MarkdownEditorProps {
  readonly value: string;
  readonly configuration: MarkdownEditorConfiguration;
  readonly onChange: (value: string) => void;
}

const editorPlaceholder = " ";

export const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
  ({ value, configuration, onChange }, ref) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const viewRef = useRef<EditorView | null>(null);
    const onChangeRef = useRef(onChange);
    const previewCompartmentRef = useRef(new Compartment());

    useEffect(() => {
      onChangeRef.current = onChange;
    }, [onChange]);

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
          previewCompartmentRef.current.of(livePreviewExtension(configuration)),
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
        effects: previewCompartmentRef.current.reconfigure(livePreviewExtension(configuration))
      });
    }, [configuration]);

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

export interface WorkbenchClipboardApi {
  writeText(text: string): Promise<void> | void;
}

export interface WorkbenchClipboardNavigator {
  readonly clipboard?: WorkbenchClipboardApi;
}

export interface WorkbenchClipboardTextArea {
  value: string;
  tabIndex: number;
  readonly style: {
    position?: string;
    inset?: string;
    opacity?: string;
  };
  setAttribute(name: string, value: string): void;
  select(): void;
  remove(): void;
}

export interface WorkbenchClipboardDocument {
  readonly body?: {
    append(element: WorkbenchClipboardTextArea): void;
  };
  createElement(tagName: "textarea"): WorkbenchClipboardTextArea;
  execCommand(command: "copy"): boolean;
}

export interface WorkbenchClipboardEnvironment {
  readonly navigator?: WorkbenchClipboardNavigator;
  readonly document?: WorkbenchClipboardDocument;
}

export function createWorkbenchClipboardEnvironment(): WorkbenchClipboardEnvironment {
  return {
    ...(typeof navigator === "undefined" ? {} : { navigator }),
    ...(typeof document === "undefined" ? {} : { document: createWorkbenchClipboardDocument(document) })
  };
}

export async function copyWorkbenchTextToClipboard(
  text: string,
  environment: WorkbenchClipboardEnvironment = createWorkbenchClipboardEnvironment()
): Promise<boolean> {
  const clipboard = environment.navigator?.clipboard;

  if (clipboard?.writeText) {
    try {
      await clipboard.writeText(text);
      return true;
    } catch {
      // Browser permission failures can still succeed through the textarea fallback.
    }
  }

  return copyWorkbenchTextToClipboardWithTextarea(text, environment.document);
}

function copyWorkbenchTextToClipboardWithTextarea(
  text: string,
  documentTarget: WorkbenchClipboardDocument | undefined
): boolean {
  if (!documentTarget?.body) {
    return false;
  }

  const textarea = documentTarget.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("aria-hidden", "true");
  textarea.tabIndex = -1;
  textarea.style.position = "fixed";
  textarea.style.inset = "0";
  textarea.style.opacity = "0";

  documentTarget.body.append(textarea);
  textarea.select();

  try {
    return documentTarget.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}

function createWorkbenchClipboardDocument(documentTarget: Document): WorkbenchClipboardDocument {
  return {
    ...(documentTarget.body
      ? {
        body: {
          append: (element) => documentTarget.body.append(element as unknown as Node)
        }
      }
      : {}),
    createElement: () => documentTarget.createElement("textarea"),
    execCommand: (command) => documentTarget.execCommand(command)
  };
}

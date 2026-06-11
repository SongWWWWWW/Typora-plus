import { describe, expect, it, vi } from "vitest";
import {
  copyWorkbenchTextToClipboard,
  type WorkbenchClipboardDocument,
  type WorkbenchClipboardTextArea
} from "./workbenchClipboard";

describe("workbench clipboard", () => {
  it("uses the clipboard API when available", async () => {
    const writeText = vi.fn(async () => undefined);
    const harness = createClipboardDocumentHarness();

    await expect(copyWorkbenchTextToClipboard("AI summary", {
      navigator: { clipboard: { writeText } },
      document: harness.document
    })).resolves.toBe(true);

    expect(writeText).toHaveBeenCalledWith("AI summary");
    expect(harness.document.createElement).not.toHaveBeenCalled();
    expect(harness.document.execCommand).not.toHaveBeenCalled();
  });

  it("falls back to a textarea when clipboard writes fail", async () => {
    const writeText = vi.fn(async () => {
      throw new Error("NotAllowedError");
    });
    const harness = createClipboardDocumentHarness();

    await expect(copyWorkbenchTextToClipboard("Fallback text", {
      navigator: { clipboard: { writeText } },
      document: harness.document
    })).resolves.toBe(true);

    expect(writeText).toHaveBeenCalledWith("Fallback text");
    expect(harness.document.body?.append).toHaveBeenCalledWith(harness.textarea);
    expect(harness.textarea.value).toBe("Fallback text");
    expect(harness.textarea.select).toHaveBeenCalledOnce();
    expect(harness.document.execCommand).toHaveBeenCalledWith("copy");
    expect(harness.textarea.remove).toHaveBeenCalledOnce();
  });

  it("uses the textarea fallback when clipboard is unavailable", async () => {
    const harness = createClipboardDocumentHarness();

    await expect(copyWorkbenchTextToClipboard("Plain text", {
      document: harness.document
    })).resolves.toBe(true);

    expect(harness.document.body?.append).toHaveBeenCalledWith(harness.textarea);
    expect(harness.document.execCommand).toHaveBeenCalledWith("copy");
  });

  it("reports failure when no clipboard path is available", async () => {
    await expect(copyWorkbenchTextToClipboard("No target", {})).resolves.toBe(false);
  });

  it("removes the textarea after failed execCommand fallback", async () => {
    const harness = createClipboardDocumentHarness(false);

    await expect(copyWorkbenchTextToClipboard("Copy me", {
      document: harness.document
    })).resolves.toBe(false);

    expect(harness.document.execCommand).toHaveBeenCalledWith("copy");
    expect(harness.textarea.remove).toHaveBeenCalledOnce();
  });
});

function createClipboardDocumentHarness(execCommandResult = true): {
  readonly document: WorkbenchClipboardDocument;
  readonly textarea: WorkbenchClipboardTextArea;
} {
  const textarea: WorkbenchClipboardTextArea = {
    value: "",
    tabIndex: 0,
    style: {},
    setAttribute: vi.fn(),
    select: vi.fn(),
    remove: vi.fn()
  };
  const document: WorkbenchClipboardDocument = {
    body: {
      append: vi.fn()
    },
    createElement: vi.fn(() => textarea),
    execCommand: vi.fn(() => execCommandResult)
  };

  return { document, textarea };
}

import { describe, expect, it } from "vitest";
import {
  createStatusMarkdownRendererProvider,
  workbenchStatusRendererId
} from "./statusMarkdownRenderer";

describe("Status Markdown renderer", () => {
  it("renders known status values with stable tone classes", async () => {
    const provider = createStatusMarkdownRendererProvider();

    await expect(Promise.resolve(provider.render({
      language: "status",
      value: "done"
    }))).resolves.toEqual({
      html: [
        `<span class="tp-renderer-status tp-renderer-status-success" title="done">`,
        `Done`,
        `</span>`
      ].join("")
    });
    expect(provider.id).toBe(workbenchStatusRendererId);
  });

  it("supports custom labels after a status key", async () => {
    const provider = createStatusMarkdownRendererProvider();

    await expect(Promise.resolve(provider.render({
      language: "status",
      value: "blocked: Waiting on API"
    }))).resolves.toEqual({
      html: [
        `<span class="tp-renderer-status tp-renderer-status-danger" title="blocked: Waiting on API">`,
        `Waiting on API`,
        `</span>`
      ].join("")
    });
  });

  it("falls back to neutral status for unknown values", async () => {
    const provider = createStatusMarkdownRendererProvider();

    await expect(Promise.resolve(provider.render({
      language: "status",
      value: "needs triage"
    }))).resolves.toEqual({
      html: [
        `<span class="tp-renderer-status tp-renderer-status-neutral" title="needs triage">`,
        `needs triage`,
        `</span>`
      ].join("")
    });
  });

  it("escapes status labels and titles", async () => {
    const provider = createStatusMarkdownRendererProvider();

    await expect(Promise.resolve(provider.render({
      language: "status",
      value: "done: A&B <ready> \"now\""
    }))).resolves.toEqual({
      html: [
        `<span class="tp-renderer-status tp-renderer-status-success" title="done: A&amp;B &lt;ready&gt; &quot;now&quot;">`,
        `A&amp;B &lt;ready&gt; "now"`,
        `</span>`
      ].join("")
    });
  });
});

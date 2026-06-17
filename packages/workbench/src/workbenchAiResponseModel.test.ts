import { describe, expect, it } from "vitest";
import {
  createWorkbenchAiResponseMetadata,
  createWorkbenchAiResponse,
  defaultWorkbenchExtractedTaskMessages,
  defaultWorkbenchExtractedTaskValidationMessages,
  formatWorkbenchExtractedTasksResponse,
  formatWorkbenchAiResponseApplyLabel,
  formatWorkbenchAiTokenUsage,
  workbenchAiResponseApplyModes
} from "./workbenchAiResponseModel";
import { workbenchAiRequestActions } from "./workbenchAiRequestModel";
import type { AiTextResponse } from "@typora-plus/platform";

describe("workbench AI response model", () => {
  it("maps active-note actions to explicit response application modes", () => {
    expect(workbenchAiResponseApplyModes).toEqual({
      continueActiveNote: "append",
      extractTasksActiveNote: "append",
      rewriteActiveNote: "replace",
      summarizeActiveNote: "append"
    });
  });

  it("creates response view models with action titles and apply modes", () => {
    const response: AiTextResponse = {
      providerId: "assistant",
      value: "Rewritten note"
    };

    expect(createWorkbenchAiResponse(
      workbenchAiRequestActions.rewriteActiveNote,
      response
    )).toEqual({
      action: "rewriteActiveNote",
      applyMode: "replace",
      response,
      title: "Rewrite Active Note"
    });
  });

  it("formats structured task extraction responses as Markdown task lists", () => {
    const response: AiTextResponse = {
      providerId: "assistant",
      value: JSON.stringify({
        groups: [
          {
            topic: "Release",
            tasks: [
              {
                title: "Ship the provider boundary",
                owner: "Maya",
                due: "Friday",
                blocker: null,
                done: false
              },
              {
                title: "Close QA checklist",
                owner: null,
                due: null,
                blocker: "Pending screenshots",
                done: true
              }
            ]
          },
          {
            topic: null,
            tasks: [
              {
                title: "Update docs",
                owner: null,
                due: null,
                blocker: null,
                done: false
              }
            ]
          }
        ]
      })
    };

    expect(createWorkbenchAiResponse(
      workbenchAiRequestActions.extractTasksActiveNote,
      response
    )).toEqual({
      action: "extractTasksActiveNote",
      applyMode: "append",
      response: {
        providerId: "assistant",
        value: [
          "### Release",
          "- [ ] Ship the provider boundary (Owner: Maya; Due: Friday)",
          "- [x] Close QA checklist (Blocker: Pending screenshots)",
          "",
          "- [ ] Update docs"
        ].join("\n")
      },
      title: "Extract Tasks From Active Note"
    });
  });

  it("formats structured task extraction responses with localized detail labels", () => {
    expect(formatWorkbenchExtractedTasksResponse(JSON.stringify({
      groups: [
        {
          topic: "发布",
          tasks: [
            {
              title: "确认同步计划",
              owner: "Maya",
              due: "周五",
              blocker: "等待验证",
              done: false
            }
          ]
        }
      ]
    }), {
      detailLabels: {
        owner: "负责人",
        due: "截止",
        blocker: "阻塞"
      },
      detail: (label, value) => `${label}：${value}`,
      detailList: (details) => details.length > 0 ? ` （${details.join("；")}）` : "",
      noActionableTasksFound: "没有找到可执行任务。"
    })).toBe([
      "### 发布",
      "- [ ] 确认同步计划 （负责人：Maya；截止：周五；阻塞：等待验证）"
    ].join("\n"));
  });

  it("escapes Markdown control characters in structured task fields", () => {
    expect(formatWorkbenchExtractedTasksResponse(JSON.stringify({
      groups: [
        {
          topic: "Release [Q1](doc)",
          tasks: [
            {
              title: "Review ![chart](asset.png) and *scope*",
              owner: "A_B",
              due: "<Friday>",
              blocker: "Needs `signoff`",
              done: false
            }
          ]
        }
      ]
    }))).toBe([
      "### Release \\[Q1\\]\\(doc\\)",
      "- [ ] Review \\!\\[chart\\]\\(asset.png\\) and \\*scope\\* (Owner: A\\_B; Due: \\<Friday\\>; Blocker: Needs \\`signoff\\`)"
    ].join("\n"));
  });

  it("handles empty and invalid structured task extraction responses", () => {
    expect(formatWorkbenchExtractedTasksResponse(JSON.stringify({
      groups: []
    }))).toBe("No actionable tasks found.");
    expect(formatWorkbenchExtractedTasksResponse(JSON.stringify({
      groups: []
    }), {
      ...defaultWorkbenchExtractedTaskMessages,
      noActionableTasksFound: "没有找到可执行任务。"
    })).toBe("没有找到可执行任务。");

    expect(() => formatWorkbenchExtractedTasksResponse("not json"))
      .toThrow("AI task extraction response must be valid JSON");
    expect(() => formatWorkbenchExtractedTasksResponse(JSON.stringify({
      groups: [
        {
          topic: "Release",
          tasks: [
            {
              title: "Ship",
              owner: null,
              due: null,
              blocker: null,
              done: "no"
            }
          ]
        }
      ]
    }))).toThrow("AI task extraction task 1 done must be a boolean");
    expect(() => formatWorkbenchExtractedTasksResponse(JSON.stringify({
      groups: new Array(51).fill({
        topic: null,
        tasks: []
      })
    }))).toThrow("AI task extraction response groups must contain at most 50 items");
  });

  it("uses injected validation messages for malformed structured task extraction responses", () => {
    const messages = {
      ...defaultWorkbenchExtractedTaskMessages,
      validation: {
        ...defaultWorkbenchExtractedTaskValidationMessages,
        labels: {
          ...defaultWorkbenchExtractedTaskValidationMessages.labels,
          responseGroups: "Localized groups",
          taskDone: (index: number) => `Localized task ${index + 1} done`
        },
        mustBeBoolean: (label: string) => `${label} localized boolean required`,
        mustBeValidJson: "Localized valid JSON required",
        mustContainAtMostItems: (label: string, maxItems: number) => `${label} localized max ${maxItems}`
      }
    };

    expect(() => formatWorkbenchExtractedTasksResponse("not json", messages))
      .toThrow("Localized valid JSON required");
    expect(() => formatWorkbenchExtractedTasksResponse(JSON.stringify({
      groups: [
        {
          topic: null,
          tasks: [{
            title: "Ship",
            owner: null,
            due: null,
            blocker: null,
            done: "no"
          }]
        }
      ]
    }), messages)).toThrow("Localized task 1 done localized boolean required");
    expect(() => formatWorkbenchExtractedTasksResponse(JSON.stringify({
      groups: new Array(51).fill({
        topic: null,
        tasks: []
      })
    }), messages)).toThrow("Localized groups localized max 50");
  });

  it("formats apply labels from mode and state", () => {
    expect(formatWorkbenchAiResponseApplyLabel("append", "idle")).toBe("Append");
    expect(formatWorkbenchAiResponseApplyLabel("append", "applied")).toBe("Appended");
    expect(formatWorkbenchAiResponseApplyLabel("append", "failed")).toBe("Append failed");
    expect(formatWorkbenchAiResponseApplyLabel("replace", "idle")).toBe("Replace");
    expect(formatWorkbenchAiResponseApplyLabel("replace", "applied")).toBe("Replaced");
    expect(formatWorkbenchAiResponseApplyLabel("replace", "failed")).toBe("Replace failed");
  });

  it("formats optional token usage metadata for AI response surfaces", () => {
    expect(formatWorkbenchAiTokenUsage(undefined)).toBeUndefined();
    expect(formatWorkbenchAiTokenUsage({})).toBeUndefined();
    expect(formatWorkbenchAiTokenUsage({
      inputTokens: 10,
      outputTokens: 4,
      totalTokens: 14
    })).toBe("10 in / 4 out / 14 total");
    expect(formatWorkbenchAiTokenUsage({
      totalTokens: 14
    })).toBe("14 total");
    expect(formatWorkbenchAiTokenUsage({
      inputTokens: 10,
      outputTokens: 4,
      totalTokens: 14
    }, {
      input: (count) => `输入 ${count}`,
      output: (count) => `输出 ${count}`,
      total: (count) => `合计 ${count}`,
      join: (parts) => parts.join(" / ")
    })).toBe("输入 10 / 输出 4 / 合计 14");
  });

  it("creates AI response metadata chips with optional model and token usage", () => {
    expect(createWorkbenchAiResponseMetadata({
      providerId: "assistant",
      model: "served-model",
      usage: {
        inputTokens: 10,
        outputTokens: 4,
        totalTokens: 14
      }
    })).toEqual([
      { id: "provider", value: "assistant" },
      { id: "model", value: "served-model" },
      { id: "usage", value: "10 in / 4 out / 14 total" }
    ]);

    expect(createWorkbenchAiResponseMetadata({
      providerId: "assistant"
    })).toEqual([{ id: "provider", value: "assistant" }]);

    expect(createWorkbenchAiResponseMetadata({
      providerId: "assistant",
      usage: {
        totalTokens: 14
      }
    }, {
      input: (count) => `输入 ${count}`,
      output: (count) => `输出 ${count}`,
      total: (count) => `合计 ${count}`,
      join: (parts) => parts.join(" / ")
    })).toEqual([
      { id: "provider", value: "assistant" },
      { id: "usage", value: "合计 14" }
    ]);

    expect(createWorkbenchAiResponseMetadata({
      providerId: "same",
      model: "same"
    })).toEqual([
      { id: "provider", value: "same" },
      { id: "model", value: "same" }
    ]);
  });
});

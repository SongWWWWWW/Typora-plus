import { describe, expect, it } from "vitest";
import {
  isSafeNativeSecretRef,
  nativeSecretRefLimits,
  normalizeNativeSecretRef
} from "./nativeSecretRefs";

describe("native secret references", () => {
  it("normalizes bounded secret references before native secret access", () => {
    const maxSecretRef = `s${"a".repeat(nativeSecretRefLimits.secretRefLength - 1)}`;

    expect(normalizeNativeSecretRef("AI", ` ${maxSecretRef} `)).toBe(maxSecretRef);
    expect(normalizeNativeSecretRef("Remote sync", "typora-plus.remote-sync.notes.access"))
      .toBe("typora-plus.remote-sync.notes.access");
    expect(isSafeNativeSecretRef(maxSecretRef)).toBe(true);
  });

  it("rejects empty, overlong, and path-like secret references", () => {
    const invalidSecretRefs = [
      "",
      "   ",
      ".hidden",
      "-dash",
      "bad/key",
      "bad\\key",
      `s${"a".repeat(nativeSecretRefLimits.secretRefLength)}`
    ];

    for (const secretRef of invalidSecretRefs) {
      expect(() => normalizeNativeSecretRef("AI", secretRef)).toThrow("AI secret reference is invalid");
      expect(isSafeNativeSecretRef(secretRef)).toBe(false);
    }
  });

  it("treats stored secret references as already-normalized identities", () => {
    expect(isSafeNativeSecretRef(" typora-plus.ai.notes ")).toBe(false);
    expect(isSafeNativeSecretRef("typora-plus.ai.notes")).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import {
  isSafeNativeConfigurationStorageKey,
  isSafeNativeSnapshotStorageKey,
  nativeStorageKeyLimits
} from "./nativeStorageKeys";

describe("native storage keys", () => {
  it("accepts bounded configuration storage keys that match platform storage identity", () => {
    const maxKey = `c${"a".repeat(nativeStorageKeyLimits.configurationStorageKeyLength - 1)}`;

    expect(isSafeNativeConfigurationStorageKey(maxKey)).toBe(true);
    expect(isSafeNativeConfigurationStorageKey("typora-plus.configuration")).toBe(true);
    expect(isSafeNativeConfigurationStorageKey(`c${"a".repeat(nativeStorageKeyLimits.configurationStorageKeyLength)}`))
      .toBe(false);
  });

  it("accepts bounded snapshot storage keys for index snapshots and manifests", () => {
    const maxKey = `s${"a".repeat(nativeStorageKeyLimits.snapshotStorageKeyLength - 1)}`;

    expect(isSafeNativeSnapshotStorageKey(maxKey)).toBe(true);
    expect(isSafeNativeSnapshotStorageKey("typora-plus.workspaceIndex.snapshot.abc123")).toBe(true);
    expect(isSafeNativeSnapshotStorageKey(`s${"a".repeat(nativeStorageKeyLimits.snapshotStorageKeyLength)}`))
      .toBe(false);
  });

  it("rejects empty, path-like, and non-platform storage keys", () => {
    for (const key of ["", ".hidden", "-dash", "bad/key", "bad\\key", "bad_key", "bad:key"]) {
      expect(isSafeNativeConfigurationStorageKey(key)).toBe(false);
      expect(isSafeNativeSnapshotStorageKey(key)).toBe(false);
    }
  });
});

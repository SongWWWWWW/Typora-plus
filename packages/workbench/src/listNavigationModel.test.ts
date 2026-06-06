import { describe, expect, it } from "vitest";
import {
  isListNavigationKey,
  moveListSelection,
  normalizeListSelection
} from "./listNavigationModel";

describe("list navigation model", () => {
  it("recognizes supported navigation keys", () => {
    expect(isListNavigationKey("ArrowDown")).toBe(true);
    expect(isListNavigationKey("ArrowUp")).toBe(true);
    expect(isListNavigationKey("Home")).toBe(true);
    expect(isListNavigationKey("End")).toBe(true);
    expect(isListNavigationKey("Enter")).toBe(false);
  });

  it("normalizes selected indexes to the available range", () => {
    expect(normalizeListSelection(2, 5)).toBe(2);
    expect(normalizeListSelection(-2, 5)).toBe(0);
    expect(normalizeListSelection(8, 5)).toBe(4);
    expect(normalizeListSelection(Number.NaN, 5)).toBe(0);
    expect(normalizeListSelection(0, 0)).toBe(-1);
  });

  it("moves selected indexes without leaving the list bounds", () => {
    expect(moveListSelection(0, 4, "ArrowDown")).toBe(1);
    expect(moveListSelection(3, 4, "ArrowDown")).toBe(3);
    expect(moveListSelection(2, 4, "ArrowUp")).toBe(1);
    expect(moveListSelection(0, 4, "ArrowUp")).toBe(0);
    expect(moveListSelection(2, 4, "Home")).toBe(0);
    expect(moveListSelection(2, 4, "End")).toBe(3);
    expect(moveListSelection(2, 0, "End")).toBe(-1);
  });
});

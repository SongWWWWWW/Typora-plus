export type ListNavigationKey = "ArrowDown" | "ArrowUp" | "Home" | "End";

export function isListNavigationKey(key: string): key is ListNavigationKey {
  return key === "ArrowDown" || key === "ArrowUp" || key === "Home" || key === "End";
}

export function normalizeListSelection(index: number, itemCount: number): number {
  if (itemCount <= 0) {
    return -1;
  }

  if (!Number.isFinite(index)) {
    return 0;
  }

  return Math.min(Math.max(Math.trunc(index), 0), itemCount - 1);
}

export function moveListSelection(index: number, itemCount: number, key: ListNavigationKey): number {
  if (itemCount <= 0) {
    return -1;
  }

  const normalizedIndex = normalizeListSelection(index, itemCount);

  switch (key) {
    case "ArrowDown":
      return Math.min(normalizedIndex + 1, itemCount - 1);
    case "ArrowUp":
      return Math.max(normalizedIndex - 1, 0);
    case "Home":
      return 0;
    case "End":
      return itemCount - 1;
  }
}

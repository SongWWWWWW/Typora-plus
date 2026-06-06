export function coalesce<T>(items: readonly (T | undefined | null | false)[]): T[] {
  return items.filter((item): item is T => Boolean(item));
}

export function equals<T>(first: readonly T[], second: readonly T[]): boolean {
  if (first === second) {
    return true;
  }

  if (first.length !== second.length) {
    return false;
  }

  return first.every((item, index) => Object.is(item, second[index]));
}

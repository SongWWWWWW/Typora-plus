export const nativeStorageKeyLimits = {
  configurationStorageKeyLength: 240,
  snapshotStorageKeyLength: 260
} as const;

export function isSafeNativeConfigurationStorageKey(value: string): boolean {
  return isSafeNativeStorageKey(value, nativeStorageKeyLimits.configurationStorageKeyLength);
}

export function isSafeNativeSnapshotStorageKey(value: string): boolean {
  return isSafeNativeStorageKey(value, nativeStorageKeyLimits.snapshotStorageKeyLength);
}

function isSafeNativeStorageKey(value: string, maxLength: number): boolean {
  return value.length > 0 &&
    value.length <= maxLength &&
    /^[A-Za-z0-9][A-Za-z0-9.-]*$/.test(value);
}

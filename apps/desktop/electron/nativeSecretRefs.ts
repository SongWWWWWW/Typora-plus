export const nativeSecretRefLimits = {
  secretRefLength: 256
} as const;

export function normalizeNativeSecretRef(label: string, value: unknown): string {
  if (typeof value !== "string") {
    throw new Error(`${label} secret reference is invalid`);
  }

  const normalized = value.trim();

  if (!isValidNormalizedNativeSecretRef(normalized)) {
    throw new Error(`${label} secret reference is invalid`);
  }

  return normalized;
}

export function isSafeNativeSecretRef(value: string): boolean {
  return value === value.trim() && isValidNormalizedNativeSecretRef(value);
}

function isValidNormalizedNativeSecretRef(value: string): boolean {
  return value.length > 0 &&
    value.length <= nativeSecretRefLimits.secretRefLength &&
    /^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(value);
}

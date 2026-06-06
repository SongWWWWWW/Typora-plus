export interface NumberSettingConstraint {
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

export const settingsNumberConstraints = {
  editorFontSize: { min: 13, max: 24, step: 1 },
  editorLineHeight: { min: 1.2, max: 2.2, step: 0.05 },
  editorMaxWidth: { min: 560, max: 1120, step: 20 },
  workspaceSearchMaxFileSizeMegabytes: { min: 1, max: 20, step: 1 },
  workspaceSearchMaxResults: { min: 20, max: 500, step: 10 }
} as const satisfies Record<string, NumberSettingConstraint>;

const bytesPerMegabyte = 1024 * 1024;

export function clampSettingNumber(value: number, constraint: NumberSettingConstraint): number {
  if (!Number.isFinite(value)) {
    return constraint.min;
  }

  const clamped = Math.min(Math.max(value, constraint.min), constraint.max);
  return Number(clamped.toFixed(stepPrecision(constraint.step)));
}

export function megabytesToBytes(value: number): number {
  return Math.round(
    clampSettingNumber(value, settingsNumberConstraints.workspaceSearchMaxFileSizeMegabytes) * bytesPerMegabyte
  );
}

export function bytesToMegabytes(value: number): number {
  return clampSettingNumber(
    value / bytesPerMegabyte,
    settingsNumberConstraints.workspaceSearchMaxFileSizeMegabytes
  );
}

export function normalizeAssetFolderInput(value: string): string | undefined {
  const normalized = value.trim().replace(/\\/g, "/");
  return normalized.length > 0 ? normalized : undefined;
}

function stepPrecision(step: number): number {
  const decimal = step.toString().split(".")[1];
  return decimal?.length ?? 0;
}

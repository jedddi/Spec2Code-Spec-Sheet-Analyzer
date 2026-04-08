export const DEFAULT_DOCUMENT_PROJECT = "Files";

const LEGACY_DEFAULT_PROJECT = "Current Thesis";

export function normalizeProjectName(
  name: string | null | undefined,
): string {
  const trimmed = name?.trim();
  if (!trimmed || trimmed === LEGACY_DEFAULT_PROJECT) {
    return DEFAULT_DOCUMENT_PROJECT;
  }
  return trimmed;
}

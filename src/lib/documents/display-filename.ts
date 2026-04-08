/** Stored object names are often `{uuid}-{original.pdf}`; show only the original part. */
const UUID_PREFIX_RE =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-(.+)$/i;

export function displayDocumentFilename(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(UUID_PREFIX_RE);
  if (match) return match[2];
  const segment = trimmed.includes("/")
    ? (trimmed.split("/").pop() ?? trimmed)
    : trimmed;
  return segment;
}

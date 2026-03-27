export interface Chunk {
  content: string;
  index: number;
}

export interface ChunkWithPage extends Chunk {
  page: number;
}

export interface PageTextInput {
  page: number;
  text: string;
}

const DEFAULT_CHUNK_SIZE = 1000;
const DEFAULT_CHUNK_OVERLAP = 200;

const SEPARATORS = ["\n\n", "\n", ". ", " ", ""];

/**
 * Recursively split `text` using progressively finer separators so that each
 * piece stays within `chunkSize` characters while preserving as much semantic
 * structure (paragraphs → sentences → words) as possible.
 */
function splitRecursive(
  text: string,
  chunkSize: number,
  separators: string[],
): string[] {
  if (text.length <= chunkSize) return [text];

  const sep = separators[0];
  const remaining = separators.slice(1);

  const parts = sep === "" ? [...text] : text.split(sep);

  const pieces: string[] = [];
  let current = "";

  for (const part of parts) {
    const candidate =
      current.length === 0 ? part : current + sep + part;

    if (candidate.length <= chunkSize) {
      current = candidate;
      continue;
    }

    if (current.length > 0) {
      pieces.push(current);
    }

    if (part.length > chunkSize && remaining.length > 0) {
      pieces.push(...splitRecursive(part, chunkSize, remaining));
      current = "";
    } else {
      current = part;
    }
  }

  if (current.length > 0) {
    pieces.push(current);
  }

  return pieces;
}

/**
 * Split a document into overlapping chunks suitable for embedding.
 *
 * @param text       - Full document text
 * @param chunkSize  - Target max characters per chunk (default 1000)
 * @param overlap    - Characters of overlap between consecutive chunks (default 200)
 */
export function chunkText(
  text: string,
  chunkSize = DEFAULT_CHUNK_SIZE,
  overlap = DEFAULT_CHUNK_OVERLAP,
): Chunk[] {
  const trimmed = text.trim();
  if (trimmed.length === 0) return [];

  const rawPieces = splitRecursive(trimmed, chunkSize, SEPARATORS);

  const chunks: Chunk[] = [];
  let idx = 0;

  for (let i = 0; i < rawPieces.length; i++) {
    const piece = rawPieces[i].trim();
    if (piece.length === 0) continue;

    chunks.push({ content: piece, index: idx });
    idx++;

    if (overlap > 0 && i < rawPieces.length - 1) {
      const overlapText = piece.slice(-overlap).trim();
      const nextPiece = rawPieces[i + 1]?.trim() ?? "";

      if (overlapText.length > 0 && nextPiece.length > 0) {
        const merged = overlapText + " " + nextPiece;
        if (merged.length <= chunkSize) {
          rawPieces[i + 1] = merged;
        }
      }
    }
  }

  return chunks;
}

/**
 * Split page-grouped text into chunks while preserving source page number.
 */
export function chunkPageText(
  pages: PageTextInput[],
  chunkSize = DEFAULT_CHUNK_SIZE,
  overlap = DEFAULT_CHUNK_OVERLAP,
): ChunkWithPage[] {
  const chunks: ChunkWithPage[] = [];
  let globalIndex = 0;

  for (const pageEntry of pages) {
    const pageText = pageEntry.text.trim();
    if (!pageText) continue;

    const pageChunks = chunkText(pageText, chunkSize, overlap);
    for (const chunk of pageChunks) {
      chunks.push({
        content: chunk.content,
        index: globalIndex,
        page: pageEntry.page,
      });
      globalIndex += 1;
    }
  }

  return chunks;
}

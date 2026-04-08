import { UnstructuredClient } from "unstructured-client";

const UNSTRUCTURED_API_KEY = process.env.UNSTRUCTURED_API_KEY;

if (!UNSTRUCTURED_API_KEY) {
  throw new Error("Missing required env var: UNSTRUCTURED_API_KEY");
}

export function createUnstructuredClient() {
  return new UnstructuredClient({
    security: { apiKeyAuth: UNSTRUCTURED_API_KEY },
  });
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .trim();
}

function elementToMarkdown(element: Record<string, unknown>): string {
  const type = typeof element.type === "string" ? element.type : "Text";
  const rawText = typeof element.text === "string" ? element.text.trim() : "";
  const metadata =
    element.metadata && typeof element.metadata === "object"
      ? (element.metadata as Record<string, unknown>)
      : {};
  const html = typeof metadata.text_as_html === "string" ? metadata.text_as_html : "";

  if (!rawText && !html) return "";

  if (type === "Title") return `## ${rawText || stripHtml(html)}`;
  if (type === "ListItem") return `- ${rawText || stripHtml(html)}`;
  if (type === "Table") return html ? stripHtml(html) : rawText;
  return rawText || stripHtml(html);
}

export function unstructuredElementsToMarkdown(elements: unknown[]): string {
  const lines: string[] = [];
  for (const entry of elements) {
    if (!entry || typeof entry !== "object") continue;
    const line = elementToMarkdown(entry as Record<string, unknown>);
    if (!line) continue;
    lines.push(line);
  }
  return lines.join("\n\n").trim();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runWithRetry<T>(
  fn: (attempt: number) => Promise<T>,
  maxAttempts = 3,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts) break;
      await sleep(500 * (2 ** (attempt - 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Unknown retry failure");
}

export async function partitionPdfToMarkdown(params: {
  file: Blob;
  fileName: string;
}) {
  const client = createUnstructuredClient();
  const response = await runWithRetry(async () => {
    const result = await client.general.partition({
      partitionParameters: {
        files: {
          content: params.file,
          fileName: params.fileName,
        },
        strategy: "hi_res",
        pdfInferTableStructure: true,
        // keep both keys to tolerate SDK naming differences
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...( { pdf_infer_table_structure: true } as any ),
      },
    });

    if (
      typeof result !== "object" ||
      result === null ||
      Array.isArray(result)
    ) {
      throw new Error("Unstructured returned unexpected response shape");
    }

    const body = result as { statusCode?: number; elements?: unknown[] };
    const statusCode = body.statusCode;
    if (typeof statusCode === "number" && (statusCode < 200 || statusCode >= 300)) {
      throw new Error(`Unstructured returned status ${statusCode}`);
    }

    return body;
  }, 3);

  const elements = Array.isArray(response.elements) ? response.elements : [];
  return {
    elements,
    markdown: unstructuredElementsToMarkdown(elements),
  };
}

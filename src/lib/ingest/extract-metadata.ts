import {
  chatComplete,
  METADATA_MODEL,
  type ChatMessage,
} from "@/src/lib/ai/openrouter";

const MAX_INPUT_CHARS = 8000;

export interface DocumentMetadata {
  category: string;
  operating_voltage: string;
  interface: string;
  power_consumption: string;
}

const SYSTEM_PROMPT = `You are a Hardware Validation Engineer. Given the beginning of a component datasheet, extract the following fields and return them as a JSON object with exactly these keys:

- "category": classify as exactly one of MCU, Sensor, Radio, Display, Power, Memory, Connector, or Other.
- "operating_voltage": the supply/VCC voltage range, e.g. "3.0V - 3.6V". Use "Not Specified" if not found.
- "interface": communication protocols (UART, SPI, I2C, GPIO, USB, etc.). Use "Not Specified" if not found.
- "power_consumption": typical or peak current draw, e.g. "240mA Peak". Use "Not Specified" if not found.

Return ONLY the JSON object, no markdown fences or extra text.`;

/**
 * Extract structured metadata from PDF text using OpenRouter structured output.
 * Only sends the first ~8000 chars to minimize token usage.
 */
export async function extractDocumentMetadata(
  fullText: string,
): Promise<DocumentMetadata> {
  const truncated = fullText.slice(0, MAX_INPUT_CHARS);

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: `Datasheet text:\n\n${truncated}` },
  ];

  const raw = await chatComplete(messages, {
    model: METADATA_MODEL,
    responseFormat: { type: "json_object" },
  });

  const parsed: DocumentMetadata = JSON.parse(raw);
  return parsed;
}

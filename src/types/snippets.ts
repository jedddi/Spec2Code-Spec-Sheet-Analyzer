export type SnippetLanguage = "cpp" | "micropython";

export type SnippetPlatform = "esp32" | "arduino";

export type SnippetInterface = "I2C" | "SPI" | "UART" | "GPIO" | "Unknown";

export type SnippetFactSource = "datasheet" | "default";

export interface SnippetProvenanceItem {
  key: string;
  value: string;
  source: SnippetFactSource;
}

export interface SnippetMetadata {
  dependency: string;
  interface: SnippetInterface;
  targetHw: SnippetPlatform;
  language: SnippetLanguage;
  confidenceScore: number;
  attributionFileName: string;
  provenance: SnippetProvenanceItem[];
}

export interface SnippetRecord {
  id: string;
  user_id: string;
  snippet_name: string;
  code_body: string;
  metadata_json: SnippetMetadata;
  source_pdf_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SnippetFilterState {
  dependency: string;
  interface: SnippetInterface | "ALL";
  targetHw: SnippetPlatform | "ALL";
  minConfidence: number;
}

export interface GenerateSnippetInput {
  sourcePdfId: string;
  language: SnippetLanguage;
  platform: SnippetPlatform;
  snippetName?: string;
}

import type {
  SnippetFactSource,
  SnippetInterface,
  SnippetLanguage,
  SnippetMetadata,
  SnippetPlatform,
  SnippetProvenanceItem,
} from "@/src/types/snippets";

interface ExtractedFacts {
  interface: SnippetInterface;
  dependency: string;
  i2cAddress: string | null;
  pins: Partial<Record<"sda" | "scl" | "mosi" | "miso" | "sck" | "cs" | "tx" | "rx", string>>;
}

export interface HybridContextResult {
  mergedFacts: ExtractedFacts;
  provenance: SnippetProvenanceItem[];
  confidenceScore: number;
}

const DEFAULTS: Record<SnippetPlatform, ExtractedFacts> = {
  esp32: {
    interface: "I2C",
    dependency: "Wire.h",
    i2cAddress: "0x76",
    pins: { sda: "GPIO21", scl: "GPIO22", mosi: "GPIO23", miso: "GPIO19", sck: "GPIO18", cs: "GPIO5", tx: "GPIO17", rx: "GPIO16" },
  },
  arduino: {
    interface: "I2C",
    dependency: "Wire.h",
    i2cAddress: "0x76",
    pins: { sda: "A4", scl: "A5", mosi: "D11", miso: "D12", sck: "D13", cs: "D10", tx: "D1", rx: "D0" },
  },
};

function detectInterface(text: string): SnippetInterface {
  if (/\bI2C\b|\bSDA\b|\bSCL\b/i.test(text)) return "I2C";
  if (/\bSPI\b|\bMOSI\b|\bMISO\b|\bSCK\b/i.test(text)) return "SPI";
  if (/\bUART\b|\bTX\b|\bRX\b|baud/i.test(text)) return "UART";
  if (/\bGPIO\b|\bdigital pin\b/i.test(text)) return "GPIO";
  return "Unknown";
}

function extractFirst(text: string, pattern: RegExp): string | null {
  const match = text.match(pattern);
  return match?.[1] ?? null;
}

function detectDependency(interfaceType: SnippetInterface, language: SnippetLanguage): string {
  if (language === "micropython") return "machine";
  if (interfaceType === "SPI") return "SPI.h";
  if (interfaceType === "UART") return "HardwareSerial.h";
  return "Wire.h";
}

function toPinLabel(pinValue: string): string {
  const upper = pinValue.toUpperCase();
  if (upper.startsWith("GPIO")) return upper;
  if (/^\d+$/.test(pinValue)) return `GPIO${pinValue}`;
  return upper;
}

function extractPins(text: string): ExtractedFacts["pins"] {
  const rawSda = extractFirst(text, /\bSDA\b[^A-Za-z0-9]{0,12}(?:GPIO)?\s*([A-Za-z]?\d{1,2})/i);
  const rawScl = extractFirst(text, /\bSCL\b[^A-Za-z0-9]{0,12}(?:GPIO)?\s*([A-Za-z]?\d{1,2})/i);
  const rawMosi = extractFirst(text, /\bMOSI\b[^A-Za-z0-9]{0,12}(?:GPIO)?\s*([A-Za-z]?\d{1,2})/i);
  const rawMiso = extractFirst(text, /\bMISO\b[^A-Za-z0-9]{0,12}(?:GPIO)?\s*([A-Za-z]?\d{1,2})/i);
  const rawSck = extractFirst(text, /\b(?:SCK|CLK)\b[^A-Za-z0-9]{0,12}(?:GPIO)?\s*([A-Za-z]?\d{1,2})/i);
  const rawCs = extractFirst(text, /\b(?:CS|SS)\b[^A-Za-z0-9]{0,12}(?:GPIO)?\s*([A-Za-z]?\d{1,2})/i);
  const rawTx = extractFirst(text, /\bTX\b[^A-Za-z0-9]{0,12}(?:GPIO)?\s*([A-Za-z]?\d{1,2})/i);
  const rawRx = extractFirst(text, /\bRX\b[^A-Za-z0-9]{0,12}(?:GPIO)?\s*([A-Za-z]?\d{1,2})/i);

  return {
    sda: rawSda ? toPinLabel(rawSda) : undefined,
    scl: rawScl ? toPinLabel(rawScl) : undefined,
    mosi: rawMosi ? toPinLabel(rawMosi) : undefined,
    miso: rawMiso ? toPinLabel(rawMiso) : undefined,
    sck: rawSck ? toPinLabel(rawSck) : undefined,
    cs: rawCs ? toPinLabel(rawCs) : undefined,
    tx: rawTx ? toPinLabel(rawTx) : undefined,
    rx: rawRx ? toPinLabel(rawRx) : undefined,
  };
}

function extractFacts(contextText: string, language: SnippetLanguage): ExtractedFacts {
  const interfaceType = detectInterface(contextText);
  const i2cAddress = extractFirst(contextText, /\b(?:addr(?:ess)?|I2C)\b[^0-9A-Fa-f]{0,20}(0x[0-9A-Fa-f]{2})/i);
  return {
    interface: interfaceType,
    dependency: detectDependency(interfaceType, language),
    i2cAddress: i2cAddress ? i2cAddress.toLowerCase() : null,
    pins: extractPins(contextText),
  };
}

function provenanceItem(key: string, value: string, source: SnippetFactSource): SnippetProvenanceItem {
  return { key, value, source };
}

export function buildHybridContext(
  contextText: string,
  language: SnippetLanguage,
  platform: SnippetPlatform,
): HybridContextResult {
  const fromDatasheet = extractFacts(contextText, language);
  const defaults = {
    ...DEFAULTS[platform],
    dependency: language === "micropython" ? "machine" : DEFAULTS[platform].dependency,
  };

  const mergedFacts: ExtractedFacts = {
    interface: fromDatasheet.interface !== "Unknown" ? fromDatasheet.interface : defaults.interface,
    dependency: fromDatasheet.dependency || defaults.dependency,
    i2cAddress: fromDatasheet.i2cAddress ?? defaults.i2cAddress,
    pins: {
      sda: fromDatasheet.pins.sda ?? defaults.pins.sda,
      scl: fromDatasheet.pins.scl ?? defaults.pins.scl,
      mosi: fromDatasheet.pins.mosi ?? defaults.pins.mosi,
      miso: fromDatasheet.pins.miso ?? defaults.pins.miso,
      sck: fromDatasheet.pins.sck ?? defaults.pins.sck,
      cs: fromDatasheet.pins.cs ?? defaults.pins.cs,
      tx: fromDatasheet.pins.tx ?? defaults.pins.tx,
      rx: fromDatasheet.pins.rx ?? defaults.pins.rx,
    },
  };

  const provenance: SnippetProvenanceItem[] = [];
  provenance.push(
    provenanceItem(
      "interface",
      mergedFacts.interface,
      fromDatasheet.interface !== "Unknown" ? "datasheet" : "default",
    ),
  );
  provenance.push(
    provenanceItem(
      "dependency",
      mergedFacts.dependency,
      fromDatasheet.interface !== "Unknown" ? "datasheet" : "default",
    ),
  );
  provenance.push(
    provenanceItem(
      "i2cAddress",
      mergedFacts.i2cAddress ?? "N/A",
      fromDatasheet.i2cAddress ? "datasheet" : "default",
    ),
  );

  for (const key of ["sda", "scl", "mosi", "miso", "sck", "cs", "tx", "rx"] as const) {
    const value = mergedFacts.pins[key];
    if (!value) continue;
    provenance.push(
      provenanceItem(
        key,
        value,
        fromDatasheet.pins[key] ? "datasheet" : "default",
      ),
    );
  }

  const datasheetCount = provenance.filter((item) => item.source === "datasheet").length;
  const confidenceScore =
    provenance.length === 0 ? 0 : Number(((datasheetCount / provenance.length) * 100).toFixed(1));

  return { mergedFacts, provenance, confidenceScore };
}

export function buildSnippetMetadata(
  args: {
    dependency: string;
    interfaceType: SnippetInterface;
    platform: SnippetPlatform;
    confidenceScore: number;
    attributionFileName: string;
    provenance: SnippetProvenanceItem[];
    language: SnippetLanguage;
  },
): SnippetMetadata {
  return {
    dependency: args.dependency,
    interface: args.interfaceType,
    targetHw: args.platform,
    confidenceScore: args.confidenceScore,
    attributionFileName: args.attributionFileName,
    provenance: args.provenance,
    language: args.language,
  };
}

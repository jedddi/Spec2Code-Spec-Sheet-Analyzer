import type { UIMessage } from "ai";

export function getTextFromUIMessage(message: UIMessage): string {
  const parts = message.parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

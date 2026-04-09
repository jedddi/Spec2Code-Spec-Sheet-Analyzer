import { serve } from "inngest/next";
import { inngest } from "@/src/lib/inngest/client";
import { inngestFunctions } from "@/src/lib/inngest/functions";

export const runtime = "nodejs";
/** Long-running ingest: Unstructured + embeddings (Vercel: raise limit on Pro as needed). */
export const maxDuration = 300;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: inngestFunctions,
  // In local Next dev, streaming can trigger `Controller is already closed` errors.
  // Disable streaming for stability; can be re-enabled in production if desired.
  streaming: false,
});

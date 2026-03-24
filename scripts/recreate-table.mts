import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const sql = `
  DROP TABLE IF EXISTS document_chunks;

  CREATE EXTENSION IF NOT EXISTS vector;

  CREATE TABLE document_chunks (
    id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    document_path text NOT NULL,
    chunk_index integer NOT NULL,
    content text NOT NULL,
    embedding vector(3072) NOT NULL,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now()
  );

  CREATE INDEX ON document_chunks
    USING hnsw (embedding vector_cosine_ops);
`;

const { error } = await supabase.rpc("exec_sql", { sql });

if (error) {
  console.log("rpc exec_sql not available, trying raw SQL via REST...");

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`,
    {
      method: "POST",
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql }),
    },
  );
  console.log("REST status:", res.status, await res.text());
} else {
  console.log("Table recreated successfully.");
}

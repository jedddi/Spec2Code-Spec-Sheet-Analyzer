"use client";

import { useState } from "react";
import { createBrowserSupabase } from "../lib/supabase/client";

export default function SupabaseStatus() {
  const [loading, setLoading] = useState(false);
  const [bucketNames, setBucketNames] = useState<string[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const supabase = createBrowserSupabase();

  async function listBuckets() {
    setLoading(true);
    setErrorMessage(null);
    setBucketNames(null);

    const { data, error } = await supabase.storage.listBuckets();

    if (error) {
      setErrorMessage(error.message);
    } else {
      setBucketNames((data ?? []).map((b: { name: string }) => b.name));
    }

    setLoading(false);
  }

  const bucketToTest = "Spec-sheets";
  const [bucketListLoading, setBucketListLoading] = useState(false);
  const [bucketListError, setBucketListError] = useState<string | null>(null);
  const [bucketListResult, setBucketListResult] = useState<unknown | null>(
    null,
  );

  async function listBucketRoot() {
    setBucketListLoading(true);
    setBucketListError(null);
    setBucketListResult(null);

    // Listing objects in a known bucket is often more reliable than listing
    // *all* buckets, which may require extra permissions.
    const { data, error } = await supabase.storage
      .from(bucketToTest)
      .list("");

    if (error) {
      setBucketListError(error.message);
    } else {
      setBucketListResult(data ?? []);
    }

    setBucketListLoading(false);
  }

  return (
    <section className="mt-10 w-full max-w-xl">
      <h2 className="text-lg font-semibold text-foreground">
        Supabase Connection Check
      </h2>

      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Click the button to verify Storage access and reveal your bucket name(s).
      </p>

      <button
        type="button"
        onClick={listBuckets}
        disabled={loading}
        className="mt-4 inline-flex items-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
      >
        {loading ? "Loading..." : "List Storage Buckets"}
      </button>

      <button
        type="button"
        onClick={listBucketRoot}
        disabled={bucketListLoading}
        className="mt-3 inline-flex items-center rounded-full bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80 disabled:opacity-60"
      >
        {bucketListLoading ? "Loading..." : `List ${bucketToTest} root`}
      </button>

      {errorMessage ? (
        <p className="mt-3 text-sm font-medium text-destructive">
          {errorMessage}
        </p>
      ) : null}

      {bucketNames ? (
        <div className="mt-4">
          <p className="text-sm font-medium text-foreground">
            Buckets:
          </p>
          <pre className="mt-2 overflow-auto rounded-lg bg-muted p-3 text-xs text-foreground">
            {JSON.stringify(bucketNames, null, 2)}
          </pre>
        </div>
      ) : null}

      {bucketListError ? (
        <p className="mt-3 text-sm font-medium text-destructive">
          Bucket test error: {bucketListError}
        </p>
      ) : null}

      {bucketListResult ? (
        <div className="mt-4">
          <p className="text-sm font-medium text-foreground">
            Files in `{bucketToTest}/`:
          </p>
          <pre className="mt-2 overflow-auto rounded-lg bg-muted p-3 text-xs text-foreground">
            {JSON.stringify(bucketListResult, null, 2)}
          </pre>
        </div>
      ) : null}
    </section>
  );
}


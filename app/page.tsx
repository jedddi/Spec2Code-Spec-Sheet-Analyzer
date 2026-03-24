"use client";

import Link from "next/link";
import { useState } from "react";
import UploadPdf from "../src/components/UploadPdf";
import FileList from "../src/components/FileList";

export default function Home() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="min-h-screen w-full bg-white">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-10 px-6 pt-10 pb-16">
        <Link
          href="/chat"
          className="inline-flex w-fit items-center rounded-full border border-blue-500 px-4 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-50"
        >
          Chat with your documents
        </Link>
        <UploadPdf onUploadComplete={() => setRefreshKey((k) => k + 1)} />
        <FileList refreshKey={refreshKey} />
      </div>
    </div>
  );
}

"use client";

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";
import { useAuth } from "@/src/hooks/useAuth";
import {
  useDocuments,
  type DocumentRecord,
} from "@/src/hooks/useDocuments";

interface DocumentsContextValue {
  documents: DocumentRecord[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  deleteDocument: (storagePath: string) => Promise<void>;
}

const DocumentsContext = createContext<DocumentsContextValue>({
  documents: [],
  loading: true,
  error: null,
  refetch: () => {},
  deleteDocument: async () => {},
});

export function DocumentsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const docs = useDocuments(user?.id);

  return (
    <DocumentsContext.Provider value={docs}>
      {children}
    </DocumentsContext.Provider>
  );
}

export function useDocumentsContext() {
  return useContext(DocumentsContext);
}

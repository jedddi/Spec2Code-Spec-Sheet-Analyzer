"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  type DocumentChatController,
  useDocumentChat,
} from "@/hooks/use-document-chat";

const DocumentChatContext = createContext<DocumentChatController | null>(null);

export function DocumentChatProvider({
  children,
}: {
  children: ReactNode;
}) {
  const chat = useDocumentChat();
  return (
    <DocumentChatContext.Provider value={chat}>
      {children}
    </DocumentChatContext.Provider>
  );
}

export function useDocumentChatContext() {
  const context = useContext(DocumentChatContext);
  if (!context) {
    throw new Error(
      "useDocumentChatContext must be used within DocumentChatProvider",
    );
  }
  return context;
}

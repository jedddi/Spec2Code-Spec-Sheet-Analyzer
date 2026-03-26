import Link from "next/link";
import ChatPanel from "@/src/components/ChatPanel";
import SignOutButton from "@/src/components/SignOutButton";

export default function ChatPage() {
  return (
    <main className="min-h-screen w-full bg-white">
      <div className="mx-auto flex h-screen w-full max-w-4xl flex-col px-6 py-8">
        <header className="mb-4 flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-zinc-900">Chat with your documents</h1>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="rounded-full border border-blue-500 px-3 py-1.5 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-50"
            >
              Back to uploads
            </Link>
            <SignOutButton />
          </div>
        </header>

        <div className="min-h-0 flex-1">
          <ChatPanel />
        </div>
      </div>
    </main>
  );
}

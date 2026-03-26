import Link from "next/link";
import { ModeToggle } from "@/components/mode-toggle";
import DocumentChat from "@/src/components/DocumentChat";
import SignOutButton from "@/src/components/SignOutButton";

export default function ChatPage() {
  return (
    <main className="min-h-screen w-full bg-background">
      <div className="mx-auto flex h-screen w-full max-w-4xl flex-col px-6 py-8">
        <header className="mb-4 flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-foreground">Chat with your documents</h1>
          <div className="flex items-center gap-2">
            <ModeToggle />
            <Link
              href="/"
              className="rounded-full border border-primary px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
            >
              Back to uploads
            </Link>
            <SignOutButton />
          </div>
        </header>

        <div className="min-h-0 flex-1">
          <DocumentChat />
        </div>
      </div>
    </main>
  );
}

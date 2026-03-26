import { Dot } from "lucide-react"

export function TypingIndicator() {
  return (
    <div className="justify-left flex space-x-1">
      <div className="rounded-lg bg-muted p-3">
        <div className="flex items-end gap-0.5">
          <span className="inline-flex animate-typing-dot-bounce [animation-delay:0ms]">
            <Dot className="h-5 w-5" aria-hidden />
          </span>
          <span className="inline-flex animate-typing-dot-bounce [animation-delay:150ms]">
            <Dot className="h-5 w-5" aria-hidden />
          </span>
          <span className="inline-flex animate-typing-dot-bounce [animation-delay:300ms]">
            <Dot className="h-5 w-5" aria-hidden />
          </span>
        </div>
      </div>
    </div>
  )
}

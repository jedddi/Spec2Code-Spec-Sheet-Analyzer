"use client";

import {
  ArrowUp,
  Image as ImageIcon,
  Mic,
  Paperclip,
  Sparkles,
} from "lucide-react";
import {
  forwardRef,
  type ChangeEventHandler,
  type FormEvent,
  type KeyboardEvent,
} from "react";

interface PromptInputV2Props {
  value: string;
  onChange: ChangeEventHandler<HTMLTextAreaElement>;
  onSubmit: (event?: FormEvent) => void;
  isSending: boolean;
}

const PromptInputV2 = forwardRef<HTMLTextAreaElement, PromptInputV2Props>(
  function PromptInputV2({ value, onChange, onSubmit, isSending }, ref) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(e);
        }}
        className="mx-auto flex h-[132px] w-full max-w-[814px] flex-col justify-between rounded-[20px] border-2 border-[#88c3ed] bg-white p-4 shadow-[0px_2px_15px_0px_var(--v2-glow)]"
      >
        {/* Top row: sparkle + divider + textarea */}
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-[#6d7078]" />
          <div className="mt-0.5 h-3 w-px shrink-0 bg-[#d9dadb]" />
          <textarea
            ref={ref}
            value={value}
            onChange={onChange}
            onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSubmit();
              }
            }}
          placeholder="Enter a Prompt"
          rows={1}
          className="w-full resize-none bg-transparent text-sm leading-5 text-[#111] outline-none placeholder:text-[#4f5059]/80"
          />
        </div>

        {/* Bottom row: action buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#d9dadb] bg-[#fafbfb] text-[#6d7078] transition-colors hover:bg-gray-100"
            >
              <Paperclip className="h-[18px] w-[18px]" />
            </button>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#d9dadb] bg-[#fafbfb] text-[#6d7078] transition-colors hover:bg-gray-100"
            >
              <ImageIcon className="h-[18px] w-[18px]" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center text-[#6d7078]"
            >
              <Mic className="h-6 w-6" />
            </button>
            <button
              type="submit"
              disabled={isSending}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--v2-primary)] text-white transition-colors hover:bg-[#0278e0] disabled:opacity-50"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </div>
        </div>
      </form>
    );
  },
);

export default PromptInputV2;

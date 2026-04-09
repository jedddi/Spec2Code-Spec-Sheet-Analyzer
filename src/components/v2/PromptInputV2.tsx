"use client";

import { cn } from "@/lib/utils";
import {
  ArrowUp,
  Image as ImageIcon,
  Mic,
  Paperclip,
  Sparkles,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import {
  forwardRef,
  useState,
  type ChangeEventHandler,
  type FormEvent,
  type KeyboardEvent,
} from "react";

interface PromptInputV2Props {
  value: string;
  onChange: ChangeEventHandler<HTMLTextAreaElement>;
  onSubmit: (event?: FormEvent) => void;
  isSending: boolean;
  className?: string;
}

const PromptInputV2 = forwardRef<HTMLTextAreaElement, PromptInputV2Props>(
  function PromptInputV2(
    { value, onChange, onSubmit, isSending, className },
    ref,
  ) {
    const [focused, setFocused] = useState(false);

    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(e);
        }}
        className={cn(
          "relative mx-auto flex h-[132px] w-full max-w-[814px] flex-col justify-between rounded-[20px] border-2 border-[#88c3ed] bg-white p-4 shadow-[0px_2px_15px_0px_var(--v2-glow)]",
          className,
        )}
      >
        <AnimatePresence>
          {focused && (
            <motion.span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-[18px] ring-2 ring-[var(--v2-primary)]/35 ring-offset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            />
          )}
        </AnimatePresence>

        {/* Top row: sparkle + divider + textarea */}
        <div className="relative z-10 flex items-start gap-3">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-[#6d7078]" />
          <div className="mt-0.5 h-3 w-px shrink-0 bg-[#d9dadb]" />
          <textarea
            ref={ref}
            value={value}
            onChange={onChange}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
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
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.button
              type="button"
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.94 }}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#d9dadb] bg-[#fafbfb] text-[#6d7078] transition-colors hover:bg-gray-100"
            >
              <Paperclip className="h-[18px] w-[18px]" />
            </motion.button>
            <motion.button
              type="button"
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.94 }}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#d9dadb] bg-[#fafbfb] text-[#6d7078] transition-colors hover:bg-gray-100"
            >
              <ImageIcon className="h-[18px] w-[18px]" />
            </motion.button>
          </div>

          <div className="flex items-center gap-3">
            <motion.button
              type="button"
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              className="flex h-6 w-6 items-center justify-center text-[#6d7078]"
            >
              <Mic className="h-6 w-6" />
            </motion.button>
            <motion.button
              type="submit"
              disabled={isSending}
              whileHover={isSending ? undefined : { scale: 1.06 }}
              whileTap={isSending ? undefined : { scale: 0.94 }}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--v2-primary)] text-white transition-colors hover:bg-[#0278e0] disabled:opacity-50"
            >
              <ArrowUp className="h-4 w-4" />
            </motion.button>
          </div>
        </div>
      </form>
    );
  },
);

export default PromptInputV2;

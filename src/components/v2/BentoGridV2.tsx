"use client";

import {
  fadeUpItem,
  staggerContainer,
  staggerContainerTight,
} from "@/src/components/v2/chat/new-chat-motion";
import { motion } from "framer-motion";
import { CircleHelp, Plus } from "lucide-react";

interface PromptItem {
  id: string;
  text: string;
}

interface BentoGridV2Props {
  prompts: PromptItem[];
  onSelect: (text: string) => void;
}

export default function BentoGridV2({ prompts, onSelect }: BentoGridV2Props) {
  return (
    <motion.section
      className="mx-auto mt-10 w-full max-w-[814px]"
      variants={staggerContainer}
    >
      <motion.p
        variants={fadeUpItem}
        className="text-xs uppercase tracking-wide text-[#888]/50"
      >
        Quick Prompts
      </motion.p>

      <motion.div
        className="mt-3 grid grid-cols-2 gap-4"
        variants={staggerContainerTight}
      >
        {prompts.map((prompt) => (
          <motion.button
            key={prompt.id}
            type="button"
            variants={fadeUpItem}
            onClick={() => onSelect(prompt.text)}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-start gap-4 rounded-2xl border border-[#e1e4ea] bg-[#fafbfb] p-5 text-left shadow-[0px_1px_2px_rgba(10,13,20,0.03)] transition-colors hover:bg-gray-50"
          >
            <CircleHelp className="mt-0.5 h-6 w-6 shrink-0 text-[var(--v2-primary)]" />
            <p className="min-w-0 flex-1 text-sm font-medium leading-[1.48] text-[#888]">
              {prompt.text}
            </p>
            <Plus className="mt-0.5 h-5 w-5 shrink-0 text-[#888]" />
          </motion.button>
        ))}
      </motion.div>
    </motion.section>
  );
}

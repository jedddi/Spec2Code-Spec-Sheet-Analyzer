"use client";

import { SiriOrb } from "@/components/ui/siri-orb";
import {
  fadeUpItem,
  staggerContainer,
} from "@/src/components/v2/chat/new-chat-motion";
import { motion } from "framer-motion";

export default function ChatInterfaceV2() {
  return (
    <motion.section
      className="flex flex-col items-center pt-[150px]"
      variants={staggerContainer}
    >
      <motion.div
        variants={fadeUpItem}
        className="relative z-10 flex h-[112px] w-[112px] shrink-0 items-center justify-center drop-shadow-[0_8px_24px_rgba(3,134,253,0.22)]"
      >
        <SiriOrb size="112px" animationDuration={22} />
      </motion.div>

      <motion.p
        variants={fadeUpItem}
        className="mt-[20px] text-center text-2xl font-semibold text-black"
      >
        Hello, How can I help you today?
      </motion.p>
    </motion.section>
  );
}

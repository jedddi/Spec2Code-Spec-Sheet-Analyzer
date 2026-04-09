import type { Transition, Variants } from "framer-motion";

/** Primary spring for staggered items (hero, cards). */
export const springSnappy: Transition = {
  type: "spring",
  stiffness: 380,
  damping: 30,
  mass: 0.85,
};

/** Slightly softer spring for larger surfaces. */
export const springSoft: Transition = {
  type: "spring",
  stiffness: 280,
  damping: 32,
  mass: 0.9,
};

/** Parent: staggers direct children with `fadeUpItem` / `fadeScaleItem`. */
export const staggerContainer: Variants = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.075,
      delayChildren: 0.06,
    },
  },
};

/** Tighter stagger for small grids. */
export const staggerContainerTight: Variants = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.055,
      delayChildren: 0.02,
    },
  },
};

export const fadeUpItem: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: springSnappy,
  },
};

export const fadeScaleItem: Variants = {
  hidden: { opacity: 0, scale: 0.98 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: springSoft,
  },
};

/** Home hero shell exit when AnimatePresence removes it. */
export const homeHeroVariants: Variants = {
  visible: { opacity: 1, y: 0, scale: 1 },
  exit: {
    opacity: 0,
    y: -10,
    scale: 0.97,
    transition: {
      type: "spring",
      stiffness: 360,
      damping: 34,
    },
  },
};

/** Chat route: empty-state panel. */
export const chatEmptyVariants: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: {
    opacity: 1,
    y: 0,
    transition: springSoft,
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.22, ease: [0.4, 0, 0.2, 1] },
  },
};

/** Chat route: thread panel. */
export const chatThreadVariants: Variants = {
  initial: { opacity: 0, y: 14 },
  animate: {
    opacity: 1,
    y: 0,
    transition: springSnappy,
  },
  exit: {
    opacity: 0,
    y: 8,
    transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] },
  },
};

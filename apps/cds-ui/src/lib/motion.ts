/**
 * Framer Motion animation presets for the CDS UI.
 * Import these as `variants` on `motion.div` elements.
 */
import type { Variants, Transition } from 'framer-motion';

// ─── Easing curves ──────────────────────────────────────

export const ease = {
  standard: [0.4, 0.0, 0.2, 1] as const,
  emphasized: [0.2, 0.0, 0, 1] as const,
  decelerate: [0.0, 0.0, 0.2, 1] as const,
  spring: { type: 'spring' as const, stiffness: 300, damping: 30 },
};

// ─── Reusable variants ──────────────────────────────────

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.25 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: ease.standard } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2 } },
};

export const fadeInDown: Variants = {
  hidden: { opacity: 0, y: -8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: ease.standard } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15 } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.2, ease: ease.emphasized } },
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.15 } },
};

export const slideFromRight: Variants = {
  hidden: { opacity: 0, x: 24 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.3, ease: ease.standard } },
  exit: { opacity: 0, x: -24, transition: { duration: 0.2 } },
};

// ─── Container variants (for staggered children) ────────

export const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
};

export const staggerFast: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.03, delayChildren: 0.05 } },
};

// ─── Modal variants ─────────────────────────────────────

export const modalBackdrop: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

export const modalContent: Variants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.25, ease: ease.emphasized } },
  exit: { opacity: 0, scale: 0.95, y: 20, transition: { duration: 0.2 } },
};

// ─── Micro-interactions ─────────────────────────────────

export const tapScale = { whileTap: { scale: 0.97 } };
export const hoverLift = { whileHover: { y: -2, transition: { duration: 0.2 } } };
export const hoverScale = { whileHover: { scale: 1.02 }, whileTap: { scale: 0.98 } };

// ─── Page transition (wrap route content in AnimatePresence) ─

export const pageTransition: Transition = {
  duration: 0.2,
  ease: ease.standard,
};

export const pageVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: pageTransition },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15 } },
};

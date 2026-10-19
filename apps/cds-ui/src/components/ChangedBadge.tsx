'use client';

import { motion } from 'framer-motion';

// ─── ChangedBadge ────────────────────────────────────────────────────────────
//
// Tiny "changed" pill used next to field labels in update forms when the
// field's current value differs from its original. Animates in so the
// provider's eye catches the diff without the UI shouting at them.
//
// Kept as a dedicated component so every future update form can reuse the
// exact same visual without copying the Tailwind classes or the Motion
// config.

export default function ChangedBadge({ label = 'changed' }: { label?: string }) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-700"
    >
      {label}
    </motion.span>
  );
}

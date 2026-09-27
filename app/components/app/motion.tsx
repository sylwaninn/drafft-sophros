// The one authored motion of sophros: a resolved case leaves its queue (fades and blurs out while the
// ones below close the gap), and new ones settle in. Reduced motion: they just appear and disappear.
import type { ReactNode } from "react";
import { AnimatePresence, motion, MotionConfig } from "motion/react";

const ease = [0.16, 1, 0.3, 1] as const;

export function QueueMotion({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence mode="popLayout" initial={false}>
        {children}
      </AnimatePresence>
    </MotionConfig>
  );
}

export function QueueItem({ id, children, className }: { id: string | number; children: ReactNode; className?: string }) {
  return (
    <motion.div
      key={id}
      layout="position"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97, filter: "blur(6px)" }}
      transition={{ duration: 0.28, ease, layout: { duration: 0.32, ease } }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

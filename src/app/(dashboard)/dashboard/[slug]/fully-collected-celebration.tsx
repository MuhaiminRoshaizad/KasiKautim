"use client";

import confetti from "canvas-confetti";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

interface FullyCollectedCelebrationProps {
  billId: string;
  allPaid: boolean;
}

const STORAGE_PREFIX = "jomsplit:celebrated:";

function storageKey(billId: string) {
  return `${STORAGE_PREFIX}${billId}`;
}

const noopSubscribe = () => () => {};

/*
 * Fires once per bill per tab session. Uses sessionStorage (read via
 * useSyncExternalStore so SSR + first client render agree on `false`) so
 * a reload or revisit within the same tab won't re-fire the celebration.
 *
 * Respects prefers-reduced-motion: no confetti, instant fade instead of
 * the spring-drop stamp.
 */
export function FullyCollectedCelebration({
  billId,
  allPaid,
}: FullyCollectedCelebrationProps) {
  const reduceMotion = useReducedMotion();
  const alreadyCelebrated = useSyncExternalStore(
    noopSubscribe,
    () => window.sessionStorage.getItem(storageKey(billId)) !== null,
    () => false,
  );
  const [dismissed, setDismissed] = useState(false);
  const startedRef = useRef(false);

  const show = allPaid && !alreadyCelebrated && !dismissed;

  const dismiss = useCallback(() => setDismissed(true), []);

  useEffect(() => {
    if (!show || startedRef.current) return;
    startedRef.current = true;
    window.sessionStorage.setItem(storageKey(billId), "1");

    const timeoutId = window.setTimeout(() => setDismissed(true), 4500);

    if (reduceMotion) {
      return () => window.clearTimeout(timeoutId);
    }

    let rafId = 0;
    const end = performance.now() + 2200;
    const tick = (now: number) => {
      if (now > end) return;
      confetti({
        particleCount: 4,
        angle: 60,
        spread: 70,
        startVelocity: 55,
        origin: { x: 0, y: 1 },
        colors: ["#3d7a4a", "#c8412c", "#f4d35e", "#1a1a1a"],
        disableForReducedMotion: true,
      });
      confetti({
        particleCount: 4,
        angle: 120,
        spread: 70,
        startVelocity: 55,
        origin: { x: 1, y: 1 },
        colors: ["#3d7a4a", "#c8412c", "#f4d35e", "#1a1a1a"],
        disableForReducedMotion: true,
      });
      rafId = window.requestAnimationFrame(tick);
    };
    rafId = window.requestAnimationFrame(tick);

    return () => {
      window.clearTimeout(timeoutId);
      window.cancelAnimationFrame(rafId);
    };
  }, [show, billId, reduceMotion]);

  useEffect(() => {
    if (!show) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDismissed(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [show]);

  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          key="fully-collected-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Bill fully collected"
          onClick={dismiss}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-paper/80 backdrop-blur-sm print:hidden"
        >
          <motion.div
            initial={
              reduceMotion
                ? { opacity: 0, scale: 1, rotate: -6 }
                : { opacity: 0, scale: 1.8, rotate: -25, y: -120 }
            }
            animate={{ opacity: 1, scale: 1, rotate: -6, y: 0 }}
            transition={
              reduceMotion
                ? { duration: 0.2 }
                : { type: "spring", stiffness: 220, damping: 14, mass: 0.9 }
            }
            className="select-none border-[6px] border-ringgit px-8 py-5 text-center"
          >
            <div className="font-display text-5xl uppercase leading-none tracking-[0.14em] text-ringgit sm:text-7xl">
              Paid in full
            </div>
            <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.4em] text-ringgit/70">
              Settled · Terima kasih
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

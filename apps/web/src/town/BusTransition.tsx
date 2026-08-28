import { useEffect, useRef, useState } from "react";
import { pixelFocusClass } from "../pixel/PixelFocusRing";
import { usePrefersReducedMotion } from "../pixel/usePrefersReducedMotion";

/** §4.8: 800–1200ms, skippable at any moment. */
export const BUS_TRANSITION_MS = 1000;

type BusTransitionProps = {
  destination: string;
  onDone: () => void;
};

/**
 * §3.8 / §4.8: the ride to town. It is a curtain, not an engine — a pixel bus
 * crossing a band of colour, always skippable, and it never gates the arrival:
 * onDone fires on the timer, on skip, and on unmount safety.
 */
export function BusTransition({ destination, onDone }: BusTransitionProps) {
  const reduceMotion = usePrefersReducedMotion();
  const [skipped, setSkipped] = useState(false);
  const doneRef = useRef(false);
  const skipRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const finish = () => {
      if (doneRef.current) {
        return;
      }
      doneRef.current = true;
      onDone();
    };

    if (reduceMotion) {
      // No ride, same arrival.
      finish();
      return;
    }
    const timer = window.setTimeout(finish, BUS_TRANSITION_MS);
    return () => window.clearTimeout(timer);
  }, [reduceMotion, onDone]);

  useEffect(() => {
    skipRef.current?.focus();
  }, []);

  function skip() {
    if (doneRef.current) {
      return;
    }
    doneRef.current = true;
    setSkipped(true);
    onDone();
  }

  if (reduceMotion || skipped) {
    return null;
  }

  return (
    <div className="bus-transition" role="dialog" aria-modal="true" aria-label="正在去镇中心">
      <p className="bus-transition__say font-pixel" aria-live="polite">
        正在去{destination}
      </p>
      <div className="bus-transition__road" aria-hidden="true">
        <span className="bus-transition__bus" />
      </div>
      <button
        ref={skipRef}
        type="button"
        className={pixelFocusClass("bus-transition__skip")}
        onClick={skip}
      >
        跳过
      </button>
    </div>
  );
}

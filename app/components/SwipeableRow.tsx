"use client";

import { useRef, useState } from "react";

/**
 * iOS-style swipe-to-delete: drag the row left to reveal a red delete
 * action. Past `commitThreshold` it deletes on release; before that it
 * snaps back. Touch only — pointer/mouse devices use the hover delete button.
 */
export function SwipeableRow({
  onDelete,
  children,
  disabled = false,
}: {
  onDelete: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  const [dx, setDx] = useState(0);
  const startX = useRef<number | null>(null);
  const startedAt = useRef<number>(0);
  const REVEAL = 80;
  const COMMIT = 160;

  function onTouchStart(e: React.TouchEvent) {
    if (disabled) return;
    startX.current = e.touches[0].clientX;
    startedAt.current = Date.now();
  }

  function onTouchMove(e: React.TouchEvent) {
    if (startX.current === null) return;
    const next = e.touches[0].clientX - startX.current;
    // Only allow left-swipe (negative)
    setDx(Math.min(0, next));
  }

  function onTouchEnd() {
    if (startX.current === null) return;
    const distance = dx;
    startX.current = null;
    if (distance < -COMMIT) {
      // Animate fully off-screen then delete
      setDx(-window.innerWidth);
      setTimeout(() => {
        setDx(0);
        onDelete();
      }, 180);
      return;
    }
    if (distance < -REVEAL) {
      setDx(-REVEAL);
      return;
    }
    setDx(0);
  }

  return (
    <div className="relative overflow-hidden">
      {/* Background delete action */}
      <button
        type="button"
        onClick={() => {
          setDx(-window.innerWidth);
          setTimeout(() => onDelete(), 180);
        }}
        className="absolute inset-y-0 right-0 grid place-items-center bg-red-600 px-5 text-sm font-medium text-white"
        style={{ width: Math.max(80, Math.abs(dx)) }}
        aria-label="Delete"
        tabIndex={-1}
      >
        Delete
      </button>

      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          transform: `translateX(${dx}px)`,
          transition: startX.current === null ? "transform 200ms cubic-bezier(0.22, 1, 0.36, 1)" : "none",
        }}
        className="relative bg-[var(--surface-glass-bg)] backdrop-blur"
      >
        {children}
      </div>
    </div>
  );
}

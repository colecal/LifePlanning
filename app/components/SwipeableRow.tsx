"use client";

import { useRef, useState } from "react";

/**
 * iOS-style swipe-to-delete: drag the row left to reveal a soft amber
 * "Delete" action. Past `commitThreshold` it deletes on release; before
 * that it snaps back. Touch only.
 *
 * The delete action only renders while the row is offset, so there's no
 * red bleed when at rest — the content sits on a transparent layer.
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
  const REVEAL = 80;
  const COMMIT = 160;

  function onTouchStart(e: React.TouchEvent) {
    if (disabled) return;
    startX.current = e.touches[0].clientX;
  }

  function onTouchMove(e: React.TouchEvent) {
    if (startX.current === null) return;
    const next = e.touches[0].clientX - startX.current;
    setDx(Math.min(0, next));
  }

  function onTouchEnd() {
    if (startX.current === null) return;
    const distance = dx;
    startX.current = null;
    if (distance < -COMMIT) {
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

  const offset = Math.abs(dx);
  const showAction = offset > 0;

  return (
    <div className="relative">
      {/* Background action only renders while swiping — no red bleed at rest */}
      {showAction ? (
        <button
          type="button"
          onClick={() => {
            setDx(-window.innerWidth);
            setTimeout(() => onDelete(), 180);
          }}
          className="absolute inset-y-0 right-0 grid place-items-center overflow-hidden text-sm font-medium text-white"
          style={{
            width: Math.max(80, offset),
            background:
              "linear-gradient(90deg, rgba(220, 38, 38, 0.0) 0%, rgba(220, 38, 38, 0.95) 30%, rgb(185, 28, 28) 100%)",
          }}
          aria-label="Delete"
          tabIndex={-1}
        >
          <span style={{ opacity: Math.min(1, offset / 60) }}>Delete</span>
        </button>
      ) : null}

      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          transform: `translateX(${dx}px)`,
          transition:
            startX.current === null
              ? "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)"
              : "none",
        }}
      >
        {children}
      </div>
    </div>
  );
}

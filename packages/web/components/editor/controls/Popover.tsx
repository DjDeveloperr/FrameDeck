"use client";

// Portal-based popover. Renders into document.body so it escapes overflow /
// transform clipping from any ancestor. Closes on outside click + Escape.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface Props {
  /** Render the trigger. Receives an `open` callback. */
  children: (api: { open: (anchor?: HTMLElement) => void; close: () => void; isOpen: boolean }) => ReactNode;
  /** Render the popover contents. Receives a `close` callback. */
  content: (close: () => void) => ReactNode;
  /** Width, in px. */
  width?: number;
  /** Vertical offset from the anchor, in px. */
  offset?: number;
  /** Horizontal alignment relative to the anchor. */
  align?: "start" | "end";
}

export function Popover({ children, content, width = 256, offset = 6, align = "start" }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const anchorRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const open = (anchor?: HTMLElement) => {
    if (anchor) anchorRef.current = anchor;
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const left = align === "end" ? rect.right - width : rect.left;
    setPosition({ left, top: rect.bottom + offset });
    setIsOpen(true);
  };
  const close = () => setIsOpen(false);

  useEffect(() => {
    if (!isOpen) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (panelRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("touchstart", onDown, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("touchstart", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen]);

  return (
    <>
      {children({ open, close, isOpen })}
      {isOpen && position && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            style={{ position: "fixed", left: position.left, top: position.top, width, zIndex: 100 }}
            className="overflow-hidden rounded-lg border border-ink-800 bg-ink-900 shadow-2xl shadow-black/60"
          >
            {content(close)}
          </div>,
          document.body,
        )}
    </>
  );
}

/** Helper to render a small modal that's centered and dimmed. Same portal idea. */
export function Modal({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{ position: "fixed", inset: 0, zIndex: 100 }}
      className="flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <div onMouseDown={(e) => e.stopPropagation()} className="max-h-[88vh] max-w-[92vw]">
        {children}
      </div>
    </div>,
    document.body,
  );
}

'use client';

import { useCallback, useEffect, useRef, type ReactNode } from 'react';

/**
 * A modal built on the native `<dialog>` element.
 *
 * `showModal()` supplies, for free and correctly, the things a hand-rolled
 * modal almost always gets wrong: focus moves into the dialog and is trapped
 * there, Escape closes it, everything behind it is inert to both the pointer
 * and the screen reader, and focus returns to whatever opened it. Reproducing
 * that with a div costs a focus-trap library and a list of edge cases.
 *
 * Two things it does *not* give you, handled below:
 *
 * - **A backdrop click does not close it.** The backdrop is a pseudo-element of
 *   the dialog, so a click on it reports the dialog as its target — which is
 *   what the geometry check uses to tell "outside" from "inside".
 * - **Escape bypasses React.** It fires the element's own `close` event without
 *   going through any handler, so state would drift out of sync with the DOM
 *   unless that event is listened for.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  const handleClose = useCallback(() => onClose(), [onClose]);

  /*
   * Runs on every commit, not only when `open` changes — deliberately.
   *
   * React state and the dialog's own open state can drift apart, because the
   * browser closes the dialog itself on Escape without asking anyone. The
   * `close` event is meant to tell us, and normally does, but it is not
   * something to stake the component on: it was observed not firing at all in
   * one embedded browser during development.
   *
   * If it ever fails to arrive, this reconciles on the next render. Without it
   * the symptom is nasty and specific: Escape appears to work, then clicking
   * the *same* row again does nothing at all, because the state never changed
   * and so nothing re-ran.
   */
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
      // The page behind must not scroll while a modal is up: on a phone the
      // background scrolls under the dialog and the reader loses their place.
      document.body.style.overflow = 'hidden';
    } else if (!open && dialog.open) {
      dialog.close();
    }

    if (!open) document.body.style.overflow = '';
  });

  /*
   * Both `cancel` and `close`, because they are not the same event and only one
   * of them is Escape-specific. `cancel` fires first when the browser is about
   * to dismiss the dialog; `close` fires once it has. Listening to either keeps
   * React's state in step whichever the browser actually delivers.
   */
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    const sync = () => {
      document.body.style.overflow = '';
      handleClose();
    };

    dialog.addEventListener('cancel', sync);
    dialog.addEventListener('close', sync);
    return () => {
      dialog.removeEventListener('cancel', sync);
      dialog.removeEventListener('close', sync);
    };
  }, [handleClose]);

  // Restore scrolling if the component unmounts while still open.
  useEffect(() => () => {
    document.body.style.overflow = '';
  }, []);

  /**
   * Closes on a click that lands outside the dialog's own box.
   *
   * Comparing against the click's coordinates rather than the target, because
   * the backdrop *is* the dialog as far as the event is concerned. A click on
   * padding inside the dialog would otherwise close it too.
   */
  function onBackdropClick(event: React.MouseEvent<HTMLDialogElement>) {
    if (event.target !== ref.current) return;

    const box = ref.current.getBoundingClientRect();
    const inside =
      event.clientX >= box.left &&
      event.clientX <= box.right &&
      event.clientY >= box.top &&
      event.clientY <= box.bottom;

    if (!inside) onClose();
  }

  return (
    <dialog
      ref={ref}
      onClick={onBackdropClick}
      aria-label={title}
      className="w-[min(44rem,calc(100vw-2rem))] border border-rule bg-paper-raised p-0 text-ink backdrop:bg-ink/40 backdrop:backdrop-blur-sm"
    >
      {/*
        Rendered only while open so the content unmounts on close — otherwise a
        previously-viewed order stays in the DOM and flashes up for a moment the
        next time the dialog is opened on a different one.
      */}
      {open ? children : null}
    </dialog>
  );
}

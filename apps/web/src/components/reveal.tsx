'use client';

import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react';

/**
 * Reveals its children as they scroll into view.
 *
 * Three things this gets right that scroll-reveal usually gets wrong:
 *
 * 1. **It cannot permanently hide content.** The hidden state lives behind a
 *    `.js` class set before first paint, so with JavaScript unavailable the
 *    element is simply visible. If the observer never fires — an old browser,
 *    a blocked script — the fallback below reveals it anyway.
 * 2. **It disconnects after revealing.** A page of forty cards would otherwise
 *    keep forty observers alive for the life of the session.
 * 3. **It honours reduced motion**, in CSS rather than JS, so the preference is
 *    respected even before hydration.
 */
export function Reveal({
  children,
  as: Tag = 'div',
  delay = 0,
  className = '',
  /** Reveal slightly before the element reaches the viewport edge. */
  rootMargin = '0px 0px -10% 0px',
}: {
  children: ReactNode;
  as?: ElementType;
  delay?: number;
  className?: string;
  rootMargin?: string;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || revealed) return;

    // No IntersectionObserver (or a very old browser): show it rather than
    // leaving it hidden forever.
    if (typeof IntersectionObserver === 'undefined') {
      setRevealed(true);
      return;
    }

    // Already in view on load — reveal without waiting for a scroll that may
    // never come.
    const rect = node.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      setRevealed(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setRevealed(true);
            observer.disconnect();
          }
        }
      },
      { rootMargin, threshold: 0.05 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [revealed, rootMargin]);

  return (
    <Tag
      ref={ref}
      className={`reveal ${className}`}
      data-revealed={revealed ? 'true' : 'false'}
      style={delay ? ({ '--reveal-delay': `${delay}ms` } as React.CSSProperties) : undefined}
    >
      {children}
    </Tag>
  );
}

/**
 * Staggers a list of children.
 *
 * The delay is capped: past about six items the eye stops reading it as a
 * sequence and starts reading it as lag, so later items land together.
 */
export function RevealGroup({
  children,
  step = 70,
  max = 6,
  className = '',
}: {
  children: ReactNode[];
  step?: number;
  max?: number;
  className?: string;
}) {
  return (
    <>
      {children.map((child, index) => (
        <Reveal key={index} delay={Math.min(index, max) * step} className={className}>
          {child}
        </Reveal>
      ))}
    </>
  );
}

'use client';

import { Children, isValidElement } from 'react';
import { Reveal } from './Reveal';

interface StaggerProps {
  /** Per-child delay step in ms. */
  step?: number;
  /** Initial delay before the first child animates. */
  initialDelay?: number;
  className?: string;
  childClassName?: string;
  children: React.ReactNode;
}

/** Wraps each child in a Reveal with an incrementing delay for a cascade. */
export function Stagger({
  step = 80,
  initialDelay = 0,
  className,
  childClassName,
  children,
}: StaggerProps) {
  const items = Children.toArray(children).filter(isValidElement);
  return (
    <div className={className}>
      {items.map((child, i) => (
        <Reveal key={i} delay={initialDelay + i * step} className={childClassName}>
          {child}
        </Reveal>
      ))}
    </div>
  );
}

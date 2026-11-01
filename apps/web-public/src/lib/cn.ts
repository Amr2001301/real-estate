import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// The theme's own font sizes (tailwind.config fontSize). Unknown to
// tailwind-merge, `text-display-2` read as a colour and dropped the colour
// next to it — the page heroes' white title came out dark.
const twMerge = extendTailwindMerge({
  extend: { classGroups: { 'font-size': [{ text: ['hero', 'display-1', 'display-2'] }] } },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

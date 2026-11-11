/** The networks a company can link (branding socialLinks), in the order they show. */
export const SOCIAL_ORDER = ['facebook', 'instagram', 'linkedin', 'youtube', 'tiktok', 'twitter'] as const;

const PATHS: Record<string, string> = {
  facebook: 'M14 8h3V4h-3a4 4 0 0 0-4 4v2H8v4h2v8h4v-8h3l1-4h-4V8.5a.5.5 0 0 1 .5-.5Z',
  instagram:
    'M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4Zm5 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm5-3.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z',
  linkedin: 'M4 9h4v12H4V9Zm2-6a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm4 6h3.8v1.7c.6-1 1.9-2 3.9-2 4 0 4.3 2.6 4.3 6V21h-4v-5.5c0-1.4 0-3.1-1.9-3.1s-2.1 1.5-2.1 3V21h-4V9Z',
  youtube:
    'M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8c1.6.4 7.8.4 7.8.4s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8ZM10 15V9l5.2 3L10 15Z',
  tiktok: 'M16 3c.3 2.2 1.6 3.6 4 3.8v3.1a7 7 0 0 1-4-1.2V15a6 6 0 1 1-6-6h.5v3.2H10a2.8 2.8 0 1 0 2.8 2.8V3H16Z',
  twitter: 'M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.3L5.3 21H2.2l7.3-8.3L2 3h6.4l4.4 5.8L17.8 3Zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5Z',
};

/** A small mark for a social network; a plain dot for one we have no mark for. */
export function SocialIcon({ name, className }: { name: string; className?: string }) {
  const d = PATHS[name];
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      {d ? <path d={d} /> : <circle cx="12" cy="12" r="4" />}
    </svg>
  );
}

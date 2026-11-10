/**
 * A line drawing of buildings on the company's deep colour: what a project or
 * unit shows until its photos are uploaded — reads as designed, never as an
 * empty box or «coming soon». Pure SVG/CSS, so it takes the tenant's colours.
 */
export function BuildingArt({ label, className }: { label: string; className?: string }) {
  return (
    <div
      role="img"
      aria-label={label}
      className={`relative h-full w-full overflow-hidden ${className ?? ''}`}
      style={{ background: 'linear-gradient(150deg, color-mix(in srgb, rgb(var(--c-navy)) 78%, black) 0%, color-mix(in srgb, rgb(var(--c-navy)) 45%, black) 100%)' }}
    >
      <span
        className="absolute inset-0 opacity-[0.08]"
        style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.9) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.9) 1px, transparent 1px)', backgroundSize: '36px 36px' }}
        aria-hidden
      />
      <span className="absolute inset-0" style={{ background: 'radial-gradient(60% 55% at 78% 12%, rgb(var(--c-gold-400) / 0.25), transparent 62%)' }} aria-hidden />
      <svg viewBox="0 0 400 260" preserveAspectRatio="xMidYMax meet" className="absolute inset-x-0 bottom-0 h-[82%] w-full" fill="none" aria-hidden>
        <g stroke="rgba(255,255,255,0.34)" strokeWidth="1.4" strokeLinejoin="round">
          {/* back tower */}
          <path d="M60 260V96h62v164" />
          <path d="M72 110h38M72 126h38M72 142h38M72 158h38M72 174h38M72 190h38M72 206h38M72 222h38" opacity=".55" />
          {/* tall centre tower */}
          <path d="M150 260V40l46-18 46 18v220" />
          <path d="M196 22v-12" />
          <path d="M164 58h64M164 76h64M164 94h64M164 112h64M164 130h64M164 148h64M164 166h64M164 184h64M164 202h64M164 220h64" opacity=".6" />
          <path d="M196 58v180" opacity=".35" />
          {/* right block */}
          <path d="M270 260V118h76v142" />
          <path d="M284 134h20v16h-20zM316 134h20v16h-20zM284 162h20v16h-20zM316 162h20v16h-20zM284 190h20v16h-20zM316 190h20v16h-20z" opacity=".6" />
          <path d="M296 260v-30h26v30" />
          {/* ground */}
          <path d="M20 260h360" stroke="rgba(255,255,255,0.45)" />
        </g>
        <g stroke="rgb(var(--c-gold-400) / 0.75)" strokeWidth="1.6">
          <path d="M150 40l46-18 46 18" />
        </g>
        {/* trees */}
        <g stroke="rgba(255,255,255,0.3)" strokeWidth="1.2">
          <circle cx="134" cy="238" r="10" /><path d="M134 248v12" />
          <circle cx="256" cy="240" r="8" /><path d="M256 248v12" />
          <circle cx="362" cy="242" r="7" /><path d="M362 249v11" />
        </g>
      </svg>
    </div>
  );
}

/** A blueprint-style floor plan drawing, for a unit whose plan is not uploaded yet. */
export function FloorPlanArt({ label, className }: { label: string; className?: string }) {
  return (
    <div
      role="img"
      aria-label={label}
      className={`relative overflow-hidden ${className ?? ''}`}
      style={{
        backgroundColor: 'color-mix(in srgb, rgb(var(--c-navy)) 60%, black)',
        backgroundImage: 'linear-gradient(rgb(var(--c-gold-400) / 0.12) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--c-gold-400) / 0.12) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}
    >
      <svg viewBox="0 0 420 260" className="mx-auto h-full w-full max-w-[560px] p-6" fill="none" aria-hidden>
        <g stroke="rgba(255,255,255,0.8)" strokeWidth="4" strokeLinecap="square">
          <path d="M30 30h360v200H30z" />
        </g>
        <g stroke="rgba(255,255,255,0.6)" strokeWidth="2.5">
          <path d="M170 30v80M170 140v90" />
          <path d="M30 120h90M150 120h20" />
          <path d="M290 30v60M290 120v110" />
          <path d="M290 150h100" />
          <path d="M170 170h60" />
        </g>
        {/* doors */}
        <g stroke="rgb(var(--c-gold-400) / 0.9)" strokeWidth="1.6">
          <path d="M170 110a30 30 0 0 1 30 30" /><path d="M120 120a30 30 0 0 0 30 -30" />
          <path d="M290 90a30 30 0 0 1 30 30" /><path d="M60 230a28 28 0 0 1 28 -28" />
        </g>
        {/* furniture hints */}
        <g stroke="rgba(255,255,255,0.35)" strokeWidth="1.4">
          <rect x="52" y="48" width="70" height="50" rx="4" /><path d="M52 60h70" />
          <rect x="310" y="44" width="60" height="38" rx="4" />
          <rect x="196" y="56" width="70" height="30" rx="6" /><rect x="206" y="96" width="50" height="22" rx="4" />
          <rect x="310" y="170" width="60" height="44" rx="4" /><path d="M310 186h60" />
          <rect x="48" y="150" width="96" height="60" rx="4" /><path d="M96 150v60" />
          <circle cx="232" cy="206" r="12" />
        </g>
      </svg>
    </div>
  );
}

import type { CSSProperties } from 'react'

// Lucide-style stroke icons (24×24, 1.6px stroke, round caps).
// Inlined to keep the extension dependency-free; color follows `currentColor`.
const PATHS: Record<string, string> = {
  settings:
    'M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4',
  paperclip:
    'm21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48',
  'arrow-up': 'M12 19V5M5 12l7-7 7 7',
  'file-text':
    'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7zM14 2v4a2 2 0 0 0 2 2h4M16 13H8M16 17H8M10 9H8',
  check: 'M20 6 9 17l-5-5',
  'check-circle': 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9 12l2 2 4-4',
  'alert-triangle':
    'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3ZM12 9v4M12 17h.01',
  'x-circle': 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM15 9l-6 6M9 9l6 6',
  x: 'M18 6 6 18M6 6l12 12',
  plus: 'M5 12h14M12 5v14',
  trophy:
    'M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z',
  sparkles:
    'M9.94 14.06A2 2 0 0 0 8.5 12.6l-5.14-1.33a.5.5 0 0 1 0-.96L8.5 8.94A2 2 0 0 0 9.94 7.5l1.33-5.14a.5.5 0 0 1 .96 0L13.56 7.5A2 2 0 0 0 15 8.94l5.14 1.33a.5.5 0 0 1 0 .96L15 12.56a2 2 0 0 0-1.44 1.44l-1.33 5.14a.5.5 0 0 1-.96 0zM20 17v3M21.5 18.5h-3',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  scan: 'M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10',
  'file-search':
    'M14 2v4a2 2 0 0 0 2 2h4M4.27 21A2 2 0 0 0 6 22h12a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v3M5 17a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM9 18l-1.5-1.5',
  globe:
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20',
  scale:
    'M12 3v18M7 21h10M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2M5 8l-3 8c.87.65 1.92 1 3 1s2.13-.35 3-1zM19 8l-3 8c.87.65 1.92 1 3 1s2.13-.35 3-1z',
  'external-link': 'M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6',
  'chevron-down': 'm6 9 6 6 6-6',
  briefcase:
    'M4 7h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2zM16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16',
  loader: 'M21 12a9 9 0 1 1-6.22-8.56',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
}

export type IconName = keyof typeof PATHS | 'stop'

interface Props {
  name: IconName
  size?: number
  strokeWidth?: number
  className?: string
  style?: CSSProperties
}

export function Icon({ name, size = 18, strokeWidth = 1.6, className, style }: Props) {
  if (name === 'stop') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        className={className}
        style={style}
        aria-hidden="true"
        focusable="false"
      >
        <rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor" />
      </svg>
    )
  }

  const d = PATHS[name]
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      <path d={d} />
    </svg>
  )
}

// Brand monogram — a "scan + spark" mark used in the header.
export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="9" fill="url(#pintar-grad)" />
      <path
        d="M11 22V10h5.2a3.6 3.6 0 0 1 0 7.2H11"
        stroke="#fff"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="m21.5 9.2.7 2.1 2.1.7-2.1.7-.7 2.1-.7-2.1-2.1-.7 2.1-.7z" fill="#fff" />
      <defs>
        <linearGradient id="pintar-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6366f1" />
          <stop offset="1" stopColor="#a855f7" />
        </linearGradient>
      </defs>
    </svg>
  )
}

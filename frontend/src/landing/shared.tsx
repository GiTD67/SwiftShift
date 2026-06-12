// Helpers shared by the marketing landing page, the auth pages, and App.tsx.
// This module must not import from App.tsx (it sits below it in the graph).

export const API_BASE = ''

export function LogoSVG({ className }: { className?: string }) {
  return (
    <img src="/logo.png" alt="SwiftShift" className={className} style={{ objectFit: 'contain' }} />
  )
}

export function getThemeAccentHex(theme: string): string {
  if (theme === 'custom') return localStorage.getItem('swiftshift-custom-accent') || '#00FF88'
  if (theme === 'white') return '#E5E7EB'
  if (theme === 'orange') return '#F97316'
  if (theme === 'cyan') return '#51FEFE'
  if (theme === 'pink') return '#FE51D7'
  if (theme === 'purple') return '#9B51FE'
  if (theme === 'red') return '#EF4444'
  if (theme === 'gold') return '#F59E0B'
  if (theme === 'teal') return '#2DD4BF'
  if (theme === 'blue') return '#60A5FA'
  return '#D7FE51'
}

import { useState } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────
type Screen = 'onboard' | 'plan' | 'verdict' | 'live' | 'record' | 'saved' | 'states' | 'desktop'
type Verdict = 'fly' | 'go' | 'watchit' | 'stop'
type Theme = 'night' | 'day'

// ── Color map per verdict ─────────────────────────────────────────────────────
const VC = {
  fly:     { color: '#a78bfa', glow: '#8b5cf6', dim: 'rgba(109,40,217,0.18)',  border: 'rgba(139,92,246,0.55)',  label: "YOU'RE GONNA FLY", sub: 'Perfect conditions — full send it',      batt: 72, energy: 28 },
  go:      { color: '#34d399', glow: '#10b981', dim: 'rgba(16,185,129,0.15)',  border: 'rgba(52,211,153,0.45)',  label: 'GO',               sub: 'Route is clear and safe to ride',        batt: 67, energy: 33 },
  watchit: { color: '#fbbf24', glow: '#f59e0b', dim: 'rgba(217,119,6,0.15)',   border: 'rgba(251,191,36,0.45)',  label: 'WATCH IT',         sub: '3 steep descents detected · max −14%',  batt: 59, energy: 41 },
  stop:    { color: '#f87171', glow: '#ef4444', dim: 'rgba(220,38,38,0.22)',   border: 'rgba(248,113,113,0.65)', label: 'STOP',             sub: 'Grade −68% · braking limit exceeded',   batt: 32, energy: 68 },
} satisfies Record<Verdict, { color: string; glow: string; dim: string; border: string; label: string; sub: string; batt: number; energy: number }>

// ── Vehicle SVG marks (custom line art) ──────────────────────────────────────

function VehicleESkate({ color = 'currentColor', size = 52 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size * 0.52} viewBox="0 0 52 27" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 14 C7 10 11 9.5 14 9.5 L38 9.5 C41 9.5 45 10 47 14" strokeWidth="2.5"/>
      <path d="M47 14 C48.2 15.2 48.2 16.5 47 17" strokeWidth="2"/>
      <path d="M5 14 C3.8 15.2 3.8 16.5 5 17" strokeWidth="2"/>
      <line x1="11" y1="9.5" x2="11" y2="15.5" strokeWidth="1.8" opacity="0.55"/>
      <line x1="41" y1="9.5" x2="41" y2="15.5" strokeWidth="1.8" opacity="0.55"/>
      <line x1="8" y1="15" x2="14" y2="15" strokeWidth="2.8"/>
      <line x1="38" y1="15" x2="44" y2="15" strokeWidth="2.8"/>
      <circle cx="9.5" cy="21.5" r="4" strokeWidth="2.2"/>
      <circle cx="42.5" cy="21.5" r="4" strokeWidth="2.2"/>
      <circle cx="9.5"  cy="21.5" r="1" fill={color} stroke="none"/>
      <circle cx="42.5" cy="21.5" r="1" fill={color} stroke="none"/>
    </svg>
  )
}

function VehicleEBike({ color = 'currentColor', size = 52 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size * 0.76} viewBox="0 0 52 40" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="28" r="9" strokeWidth="2.2"/>
      <circle cx="40" cy="28" r="9" strokeWidth="2.2"/>
      <circle cx="12" cy="28" r="2.5" fill={color} stroke="none"/>
      <circle cx="40" cy="28" r="2.5" fill={color} stroke="none"/>
      <path d="M40 28 L26 11 L12 28" strokeWidth="2.2"/>
      <path d="M26 11 L26 18 M22 18 L30 18" strokeWidth="2"/>
      <path d="M40 28 L32 22" strokeWidth="2"/>
      <circle cx="33" cy="11" r="3.5" strokeWidth="1.8"/>
      <path d="M26 11 L33 11" strokeWidth="1.8" opacity="0.6"/>
      <path d="M33 7.5 L33 14.5" strokeWidth="1.5" opacity="0.5"/>
    </svg>
  )
}

function VehicleEScooter({ color = 'currentColor', size = 48 }: { color?: string; size?: number }) {
  return (
    <svg width={size * 0.9} height={size} viewBox="0 0 44 48" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="36" cy="38" r="8" strokeWidth="2.2"/>
      <circle cx="10" cy="38" r="5.5" strokeWidth="2.2"/>
      <circle cx="36" cy="38" r="2" fill={color} stroke="none"/>
      <circle cx="10" cy="38" r="1.5" fill={color} stroke="none"/>
      <path d="M10 38 L10 16 L28 6 L36 6 L36 22 L10 32" strokeWidth="2.2"/>
      <path d="M32 6 L40 6" strokeWidth="2.8"/>
      <line x1="36" y1="22" x2="36" y2="30" strokeWidth="2" opacity="0.55"/>
      <rect x="22" y="14" width="12" height="8" rx="2" strokeWidth="1.8" opacity="0.6"/>
    </svg>
  )
}

function VehicleEUC({ color = 'currentColor', size = 44 }: { color?: string; size?: number }) {
  return (
    <svg width={size * 0.8} height={size} viewBox="0 0 36 46" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="30" r="14" strokeWidth="2.2"/>
      <circle cx="18" cy="30" r="4" strokeWidth="1.8"/>
      <rect x="11" y="8" width="14" height="18" rx="3" strokeWidth="2"/>
      <line x1="14" y1="26" x2="22" y2="26" strokeWidth="1.5" opacity="0.5"/>
      <path d="M14 16 L22 16" strokeWidth="1.5" opacity="0.4"/>
    </svg>
  )
}

function VehiclePushSkate({ color = 'currentColor', size = 52 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size * 0.5} viewBox="0 0 52 26" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 13 C7 9.5 11 9 14 9 L38 9 C41 9 45 9.5 47 13" strokeWidth="2.5"/>
      <line x1="11" y1="9" x2="11" y2="14.5" strokeWidth="1.8" opacity="0.45"/>
      <line x1="41" y1="9" x2="41" y2="14.5" strokeWidth="1.8" opacity="0.45"/>
      <line x1="8" y1="14" x2="14" y2="14" strokeWidth="2.6"/>
      <line x1="38" y1="14" x2="44" y2="14" strokeWidth="2.6"/>
      <circle cx="9.5" cy="20.5" r="3.8" strokeWidth="2.2"/>
      <circle cx="42.5" cy="20.5" r="3.8" strokeWidth="2.2"/>
    </svg>
  )
}

function VehiclePedalBike({ color = 'currentColor', size = 52 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size * 0.76} viewBox="0 0 52 40" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="28" r="9" strokeWidth="2.2"/>
      <circle cx="40" cy="28" r="9" strokeWidth="2.2"/>
      <path d="M40 28 L26 10 L12 28" strokeWidth="2.2"/>
      <path d="M26 10 L26 17 M21 17 L31 17" strokeWidth="2"/>
      <circle cx="26" cy="26" r="4" strokeWidth="1.8"/>
      <path d="M26 22 L26 26 M22 28 L26 26 M30 28 L26 26" strokeWidth="1.5" opacity="0.6"/>
    </svg>
  )
}

function VehicleKickScooter({ color = 'currentColor', size = 48 }: { color?: string; size?: number }) {
  return (
    <svg width={size * 0.9} height={size} viewBox="0 0 44 48" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="36" cy="38" r="8" strokeWidth="2.2"/>
      <circle cx="10" cy="38" r="5.5" strokeWidth="2.2"/>
      <circle cx="36" cy="38" r="2" fill={color} stroke="none"/>
      <path d="M10 38 L10 16 L28 6 L36 6 L36 28 L10 34" strokeWidth="2.2"/>
      <path d="M32 6 L40 6" strokeWidth="2.8"/>
    </svg>
  )
}

const MODES = [
  { id: 'eskate',   label: 'E-Skate',     electric: true,  Icon: VehicleESkate },
  { id: 'ebike',    label: 'E-Bike',      electric: true,  Icon: VehicleEBike },
  { id: 'escooter', label: 'E-Scooter',   electric: true,  Icon: VehicleEScooter },
  { id: 'euc',      label: 'EUC',         electric: true,  Icon: VehicleEUC },
  { id: 'push',     label: 'Push Skate',  electric: false, Icon: VehiclePushSkate },
  { id: 'pedal',    label: 'Pedal Bike',  electric: false, Icon: VehiclePedalBike },
  { id: 'kick',     label: 'Kick Scooter',electric: false, Icon: VehicleKickScooter },
]

const SAVED = [
  { name: 'Morning Commute',  from: 'Home',         to: 'Civic Tower',    mode: 'eskate',   dist: '4.2', climb: '+38',  batt: 72, verdict: 'go'      as Verdict, date: 'Today' },
  { name: 'Downtown Loop',    from: 'Civic Tower',  to: 'Market Square',  mode: 'eskate',   dist: '2.8', climb: '+12',  batt: 91, verdict: 'fly'     as Verdict, date: 'Yesterday' },
  { name: 'Park Ridge Run',   from: 'Home',         to: 'Eastview Park',  mode: 'ebike',    dist: '8.1', climb: '+124', batt: 55, verdict: 'watchit' as Verdict, date: 'Mon' },
  { name: 'Summit Attempt',   from: 'Base Station', to: 'Summit View',    mode: 'euc',      dist: '3.3', climb: '+290', batt: 18, verdict: 'stop'    as Verdict, date: 'Sun' },
]

// ── Route motif decoration ────────────────────────────────────────────────────
function RouteMotif({ opacity = 0.18 }: { opacity?: number }) {
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 380 700" preserveAspectRatio="xMidYMid slice" style={{ opacity }}>
      <defs>
        <linearGradient id="rm-grad" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%"   stopColor="#8b5cf6" stopOpacity="0"/>
          <stop offset="40%"  stopColor="#8b5cf6" stopOpacity="1"/>
          <stop offset="80%"  stopColor="#22d3ee" stopOpacity="1"/>
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d="M-20 680 Q 60 580 120 480 Q 200 360 280 260 Q 340 180 420 80"
        fill="none" stroke="url(#rm-grad)" strokeWidth="1.2" strokeDasharray="5 4"/>
    </svg>
  )
}

// ── City map ──────────────────────────────────────────────────────────────────
function CityMap({ dark, live, verdict, dimmed }: { dark: boolean; live?: boolean; verdict?: Verdict; dimmed?: boolean }) {
  const routeColor = verdict ? VC[verdict].color : '#8b5cf6'
  const routeGlow  = verdict ? VC[verdict].glow  : '#8b5cf6'
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ opacity: dimmed ? 0.45 : 1 }}>
      {/* base */}
      <div className="absolute inset-0" style={{
        background: dark
          ? 'radial-gradient(ellipse at 38% 62%, rgba(109,40,217,0.15) 0%, transparent 55%), linear-gradient(160deg, #06060e 0%, #0c0c1e 100%)'
          : 'radial-gradient(ellipse at 38% 62%, rgba(96,165,250,0.2) 0%, transparent 55%), linear-gradient(160deg, #dbeafe 0%, #eff6ff 100%)',
      }}/>
      {/* grid */}
      <div className="absolute inset-0" style={{
        backgroundImage: dark
          ? 'linear-gradient(rgba(139,92,246,0.055) 1px,transparent 1px),linear-gradient(90deg,rgba(139,92,246,0.055) 1px,transparent 1px)'
          : 'linear-gradient(rgba(59,130,246,0.14) 1px,transparent 1px),linear-gradient(90deg,rgba(59,130,246,0.14) 1px,transparent 1px)',
        backgroundSize: '48px 48px',
      }}/>
      {/* blocks + route */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 820 540" preserveAspectRatio="xMidYMid slice">
        {[
          [52,28,128,92],[208,28,102,72],[332,28,158,88],[514,28,96,66],[644,28,134,90],
          [52,154,90,134],[164,158,170,66],[354,154,96,86],[476,144,134,96],[630,150,152,114],
          [52,316,148,106],[224,298,88,114],[332,304,170,84],[524,296,110,120],[664,304,112,98],
          [52,438,104,66],[184,444,148,60],[354,434,128,82],[506,446,154,70],[684,430,104,82],
        ].map(([x,y,w,h],i) => (
          <rect key={i} x={x} y={y} width={w} height={h} rx="3"
            fill={dark ? `rgba(${14+i%6*2},${12+i%4*3},${32+i%5*6},0.92)` : `rgba(${185+i%4*5},${222-i%5*3},${248-i%6*4},0.78)`}
            stroke={dark ? 'rgba(139,92,246,0.09)' : 'rgba(59,130,246,0.16)'} strokeWidth="1"/>
        ))}

        {/* route (remaining/planned — dashed) */}
        {live ? (
          <path d="M80,504 C130,446 175,402 235,352 S365,278 418,228 S535,162 615,106 L718,60"
            fill="none" stroke="rgba(139,92,246,0.45)" strokeWidth="2.5" strokeDasharray="10 7"/>
        ) : (
          <path d="M80,504 C130,446 175,402 235,352 S365,278 418,228 S535,162 615,106 L718,60"
            fill="none" stroke={verdict ? `${routeColor}cc` : 'rgba(139,92,246,0.88)'} strokeWidth="3.5"
            style={dark ? { filter: `drop-shadow(0 0 7px ${routeGlow}) drop-shadow(0 0 18px ${routeGlow}88)` } : {}}
            className={verdict ? '' : 'anim-route'}/>
        )}

        {/* traveled (live: solid cyan) */}
        {live && (
          <path d="M80,504 C130,446 175,402 235,352 S295,310 325,282"
            fill="none" stroke="#22d3ee" strokeWidth="4"
            style={{ filter: 'drop-shadow(0 0 9px rgba(34,211,238,1)) drop-shadow(0 0 20px rgba(34,211,238,0.5))' }}/>
        )}

        {/* origin */}
        <circle cx="80" cy="504" r="8" fill={dark ? '#8b5cf6' : '#7c3aed'}
          style={dark ? { filter: 'drop-shadow(0 0 12px rgba(139,92,246,0.9))' } : {}}/>
        <circle cx="80" cy="504" r="15" fill="none" stroke="rgba(139,92,246,0.3)" strokeWidth="1.5"/>

        {/* destination */}
        <circle cx="718" cy="60" r="7" fill={dark ? '#22d3ee' : '#0891b2'}
          style={dark ? { filter: 'drop-shadow(0 0 10px rgba(34,211,238,0.9))' } : {}}/>
        <circle cx="718" cy="60" r="13" fill="none" stroke="rgba(34,211,238,0.3)" strokeWidth="1.5"/>

        {/* rider dot */}
        {live && (
          <g>
            <circle cx="325" cy="282" r="22" fill="rgba(34,211,238,0.09)" className="anim-rider"/>
            <circle cx="325" cy="282" r="10" fill="rgba(34,211,238,0.22)"/>
            <circle cx="325" cy="282" r="5" fill="#22d3ee"
              style={{ filter: 'drop-shadow(0 0 12px rgba(34,211,238,1))' }}/>
            {/* GPS halo */}
            <circle cx="325" cy="282" r="28" fill="none" stroke="rgba(34,211,238,0.14)" strokeWidth="1" strokeDasharray="3 3"/>
          </g>
        )}

        {/* hill warning badge */}
        {live && (
          <g transform="translate(446,218)">
            <polygon points="-46,-20 46,-20 54,0 46,20 -46,20 -54,0"
              fill="rgba(245,158,11,0.95)" stroke="rgba(245,158,11,0.5)" strokeWidth="1"/>
            <text x="0" y="-5" textAnchor="middle" fill="#000" fontSize="9" fontFamily="Rajdhani, sans-serif" fontWeight="700" letterSpacing="1">STEEP DESCENT</text>
            <text x="0" y="9" textAnchor="middle" fill="#000" fontSize="9" fontFamily="JetBrains Mono, monospace" fontWeight="600">▼ −12%  1.2 km</text>
          </g>
        )}
      </svg>
    </div>
  )
}

// ── Battery ring ──────────────────────────────────────────────────────────────
function BattRing({ pct, color, size = 80 }: { pct: number; color: string; size?: number }) {
  const r = size / 2 - 7, c = 2 * Math.PI * r
  const dash = Math.max(0, pct / 100) * c
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} className="absolute inset-0" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="4.5"/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="4.5"
          strokeDasharray={`${dash} ${c}`} strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${color})` }}/>
      </svg>
      <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 11, fontWeight: 600, color, lineHeight: 1 }}>{pct}%</div>
    </div>
  )
}

// ── Elevation profile ─────────────────────────────────────────────────────────
function ElevProfile({ verdict, dark }: { verdict: Verdict; dark: boolean }) {
  const V = VC[verdict]
  const pts = 'M0,60 C28,56 48,48 72,38 S110,20 138,10 L158,18 C178,12 208,22 240,36 S268,50 300,60'
  const danger = verdict === 'stop' ? 'M110,22 L138,10 L158,18' : verdict === 'watchit' ? 'M72,38 C92,28 110,22 138,10' : null
  const peakX = 138, peakY = 10
  return (
    <div style={{ background: dark ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.04)', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px 2px' }}>
        <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 8, color: dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.38)', letterSpacing: '0.14em' }}>ELEVATION PROFILE</span>
        <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 8, color: dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.38)' }}>
          {verdict === 'stop' ? '+290 m' : verdict === 'watchit' ? '+124 m' : verdict === 'go' ? '+38 m' : '+18 m'}
        </span>
      </div>
      <svg viewBox="0 0 300 65" style={{ width: '100%', height: 58, display: 'block' }}>
        <defs>
          <linearGradient id={`eg-${verdict}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={V.color} stopOpacity="0.32"/>
            <stop offset="100%" stopColor={V.color} stopOpacity="0"/>
          </linearGradient>
        </defs>
        <path d={`${pts} L300,60 L0,60 Z`} fill={`url(#eg-${verdict})`}/>
        <path d={pts} fill="none" stroke={V.color} strokeWidth="1.8" strokeLinecap="round"
          style={dark ? { filter: `drop-shadow(0 0 4px ${V.glow})` } : {}}/>
        {danger && (
          <path d={danger} fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round"
            style={{ filter: 'drop-shadow(0 0 5px #ef4444)' }}/>
        )}
        {(verdict === 'stop' || verdict === 'watchit') && (
          <>
            <circle cx={peakX} cy={peakY} r="4" fill={verdict === 'stop' ? '#ef4444' : '#fbbf24'}
              style={{ filter: `drop-shadow(0 0 6px ${verdict === 'stop' ? '#ef4444' : '#fbbf24'})` }}/>
            <text x={peakX + 7} y={peakY + 4} fontSize="8" fill={verdict === 'stop' ? '#ef4444' : '#fbbf24'} fontFamily="JetBrains Mono, monospace" fontWeight="600">
              {verdict === 'stop' ? '−68%' : '−14%'}
            </text>
          </>
        )}
      </svg>
      <div style={{ display: 'flex', gap: 12, padding: '0 12px 8px' }}>
        {[{ l: 'Safe', c: '#34d399' }, { l: 'Steep', c: '#fbbf24' }, { l: 'Danger', c: '#ef4444' }].map(g => (
          <div key={g.l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 14, height: 3, borderRadius: 2, background: g.c }}/>
            <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 8, color: dark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.38)' }}>{g.l}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Stat block ────────────────────────────────────────────────────────────────
function Stat({ label, value, unit, color, dark, accent }: { label: string; value: string; unit: string; color?: string; dark: boolean; accent?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingLeft: accent ? 8 : 0, borderLeft: accent ? `2px solid ${accent}` : 'none' }}>
      <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 8, letterSpacing: '0.13em', color: dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.38)' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
        <span style={{ fontFamily: 'var(--ff-display)', fontWeight: 700, fontSize: 26, lineHeight: 1, color: color ?? (dark ? '#f1f5f9' : '#0f172a') }}>{value}</span>
        <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 9, color: dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.38)' }}>{unit}</span>
      </div>
    </div>
  )
}

// ── Panel header ──────────────────────────────────────────────────────────────
function PanelHeader({ dark, online = true, theme, onTheme }: { dark: boolean; online?: boolean; theme?: Theme; onTheme?: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${dark ? 'rgba(139,92,246,0.15)' : 'rgba(0,0,0,0.08)'}` }}>
      <span style={{ fontFamily: 'var(--ff-display)', fontWeight: 700, fontSize: 22, letterSpacing: '-0.01em', background: 'linear-gradient(130deg, #a78bfa 0%, #22d3ee 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        GradientRip
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* online indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', background: online ? 'rgba(52,211,153,0.12)' : 'rgba(148,163,184,0.1)', clipPath: 'polygon(5px 0,100% 0,calc(100% - 5px) 100%,0 100%)', border: `1px solid ${online ? 'rgba(52,211,153,0.35)' : 'rgba(148,163,184,0.25)'}` }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: online ? '#34d399' : '#94a3b8' }}/>
          <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 8, color: online ? '#34d399' : '#94a3b8', letterSpacing: '0.1em' }}>{online ? 'ONLINE' : 'OFFLINE'}</span>
        </div>
        {onTheme && (
          <button onClick={onTheme}
            style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, cursor: 'pointer', color: dark ? '#a78bfa' : '#6d28d9', fontSize: 14 }}>
            {theme === 'night' ? '☾' : '☀'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Tab bar ───────────────────────────────────────────────────────────────────
function TabBar({ active, dark, onChange }: { active: string; dark: boolean; onChange?: (t: string) => void }) {
  return (
    <div style={{ display: 'flex', padding: '10px 20px 0', gap: 2 }}>
      {['Plan', 'Saved', 'Ride'].map((t, i) => {
        const isActive = (i === 0 && active === 'plan') || (i === 1 && active === 'saved') || (i === 2 && active === 'live')
        return (
          <button key={t} onClick={() => onChange?.(t.toLowerCase())}
            style={{ flex: 1, padding: '7px 0', fontFamily: 'var(--ff-display)', fontSize: 14, fontWeight: 700, letterSpacing: '0.06em', cursor: 'pointer', transition: 'all 0.2s',
              color: isActive ? '#a78bfa' : dark ? 'rgba(255,255,255,0.32)' : 'rgba(0,0,0,0.38)',
              background: 'transparent', border: 'none',
              borderBottom: `2px solid ${isActive ? '#8b5cf6' : 'transparent'}`,
            }}>{t}</button>
        )
      })}
    </div>
  )
}

// ── CTA button (slash shape) ──────────────────────────────────────────────────
function SlashBtn({ label, color, textColor = '#fff', onClick, secondary }: { label: string; color: string; textColor?: string; onClick?: () => void; secondary?: boolean }) {
  return (
    <button onClick={onClick}
      style={{ flex: 1, padding: '13px 20px', fontFamily: 'var(--ff-display)', fontWeight: 700, fontSize: 16, letterSpacing: '0.07em', cursor: 'pointer', transition: 'opacity 0.15s',
        background: secondary ? 'rgba(255,255,255,0.06)' : color,
        color: secondary ? 'rgba(255,255,255,0.55)' : textColor,
        border: secondary ? '1px solid rgba(255,255,255,0.12)' : `1px solid ${color}`,
        clipPath: 'polygon(10px 0,100% 0,calc(100% - 10px) 100%,0 100%)',
        boxShadow: secondary ? 'none' : `0 4px 24px ${color}66`,
      }}>
      {label}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN: Onboarding
// ─────────────────────────────────────────────────────────────────────────────
function ScreenOnboard({ dark }: { dark: boolean }) {
  const [mode, setMode] = useState('eskate')
  const selected = MODES.find(m => m.id === mode)!
  return (
    <div className="absolute inset-0 flex flex-col overflow-y-auto" style={{ background: dark ? 'linear-gradient(160deg, #06060e 0%, #0d0d22 100%)' : 'linear-gradient(160deg, #dbeafe 0%, #eff6ff 100%)' }}>
      {/* grid bg */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: dark
          ? 'linear-gradient(rgba(139,92,246,0.055) 1px,transparent 1px),linear-gradient(90deg,rgba(139,92,246,0.055) 1px,transparent 1px)'
          : 'linear-gradient(rgba(96,165,250,0.12) 1px,transparent 1px),linear-gradient(90deg,rgba(96,165,250,0.12) 1px,transparent 1px)',
        backgroundSize: '48px 48px',
      }}/>
      <RouteMotif opacity={0.14}/>

      <div className="relative flex flex-col items-center flex-1 justify-center gap-8 px-6 py-10">
        {/* wordmark */}
        <div className="flex flex-col items-center gap-2 anim-slide-up">
          {/* route mark */}
          <svg width="48" height="32" viewBox="0 0 48 32" fill="none">
            <path d="M4 28 Q 8 20 16 16 Q 24 12 32 8 Q 38 4 44 4" stroke="#8b5cf6" strokeWidth="2.5" strokeLinecap="round"
              style={{ filter: 'drop-shadow(0 0 6px rgba(139,92,246,0.8))' }}/>
            <circle cx="4"  cy="28" r="3.5" fill="#8b5cf6" style={{ filter: 'drop-shadow(0 0 6px rgba(139,92,246,0.9))' }}/>
            <circle cx="44" cy="4"  r="3.5" fill="#22d3ee" style={{ filter: 'drop-shadow(0 0 6px rgba(34,211,238,0.9))' }}/>
          </svg>
          <h1 style={{ fontFamily: 'var(--ff-display)', fontWeight: 700, fontSize: 52, letterSpacing: '-0.02em', lineHeight: 1, margin: 0,
            background: 'linear-gradient(130deg, #a78bfa 0%, #22d3ee 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            textShadow: 'none', filter: dark ? 'drop-shadow(0 0 30px rgba(139,92,246,0.35))' : 'none',
          }}>GradientRip</h1>
          <p style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, letterSpacing: '0.2em', color: dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.38)', margin: 0 }}>CAN YOUR BOARD HANDLE IT?</p>
        </div>

        {/* mode grid */}
        <div className="w-full max-w-sm anim-slide-up" style={{ animationDelay: '0.1s' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 8, letterSpacing: '0.16em', color: dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.38)' }}>CHOOSE YOUR RIDE</span>
            <div style={{ flex: 1, height: 1, background: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)' }}/>
          </div>
          {/* Electric row */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 8, letterSpacing: '0.1em', color: '#8b5cf6', alignSelf: 'center', width: 20, writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>⚡</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, flex: 1 }}>
              {MODES.filter(m => m.electric).map(m => {
                const active = mode === m.id
                return (
                  <button key={m.id} onClick={() => setMode(m.id)}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '10px 8px 8px',
                      background: active ? 'rgba(109,40,217,0.28)' : dark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.65)',
                      border: `1px solid ${active ? '#8b5cf6' : dark ? 'rgba(255,255,255,0.09)' : 'rgba(59,130,246,0.2)'}`,
                      borderRadius: 10, cursor: 'pointer', transition: 'all 0.18s',
                      boxShadow: active ? '0 0 18px rgba(139,92,246,0.3)' : 'none',
                      clipPath: active ? 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)' : 'none',
                    }}>
                    <m.Icon color={active ? '#a78bfa' : dark ? 'rgba(255,255,255,0.45)' : 'rgba(59,130,246,0.7)'} size={36}/>
                    <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 7, fontWeight: 600, letterSpacing: '0.08em', color: active ? '#a78bfa' : dark ? 'rgba(255,255,255,0.38)' : 'rgba(59,130,246,0.8)', textAlign: 'center' }}>{m.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
          {/* Human row */}
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 8, letterSpacing: '0.1em', color: '#60a5fa', alignSelf: 'center', width: 20, writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>○</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, flex: 1 }}>
              {MODES.filter(m => !m.electric).map(m => {
                const active = mode === m.id
                return (
                  <button key={m.id} onClick={() => setMode(m.id)}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '10px 8px 8px',
                      background: active ? 'rgba(59,130,246,0.22)' : dark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.65)',
                      border: `1px solid ${active ? '#60a5fa' : dark ? 'rgba(255,255,255,0.09)' : 'rgba(96,165,250,0.2)'}`,
                      borderRadius: 10, cursor: 'pointer', transition: 'all 0.18s',
                      boxShadow: active ? '0 0 14px rgba(96,165,250,0.25)' : 'none',
                      clipPath: active ? 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)' : 'none',
                    }}>
                    <m.Icon color={active ? '#93c5fd' : dark ? 'rgba(255,255,255,0.4)' : 'rgba(96,165,250,0.7)'} size={36}/>
                    <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 7, fontWeight: 600, letterSpacing: '0.08em', color: active ? '#93c5fd' : dark ? 'rgba(255,255,255,0.38)' : 'rgba(96,165,250,0.8)', textAlign: 'center' }}>{m.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* config */}
        {selected.electric && (
          <div className="w-full max-w-sm anim-slide-up" style={{ animationDelay: '0.18s', background: dark ? 'rgba(255,255,255,0.035)' : 'rgba(255,255,255,0.7)', border: `1px solid ${dark ? 'rgba(139,92,246,0.2)' : 'rgba(96,165,250,0.3)'}`, borderRadius: 12 }}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
              <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 8, letterSpacing: '0.14em', color: dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.38)' }}>BOARD CONFIGURATION</span>
            </div>
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[{ l: 'BATTERY', v: '10 Ah', pct: 0.72 }, { l: 'MAX CLIMB', v: '25%', pct: 0.5 }, { l: 'RIDER WEIGHT', v: '78 kg', pct: 0.56 }].map(cfg => (
                <div key={cfg.l} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 8, color: dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.38)', width: 88, flexShrink: 0, letterSpacing: '0.08em' }}>{cfg.l}</span>
                  <div style={{ flex: 1, height: 3, borderRadius: 2, background: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)' }}>
                    <div style={{ width: `${cfg.pct * 100}%`, height: '100%', borderRadius: 2, background: 'linear-gradient(90deg, #7c3aed, #a78bfa)', boxShadow: '0 0 6px rgba(139,92,246,0.5)' }}/>
                  </div>
                  <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 9, fontWeight: 600, color: '#a78bfa', width: 38, textAlign: 'right' }}>{cfg.v}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="w-full max-w-sm anim-slide-up" style={{ animationDelay: '0.24s' }}>
          <button style={{ width: '100%', padding: '15px 24px', fontFamily: 'var(--ff-display)', fontWeight: 700, fontSize: 18, letterSpacing: '0.08em', color: '#fff', background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)', border: '1px solid rgba(139,92,246,0.6)', clipPath: 'polygon(14px 0, 100% 0, calc(100% - 14px) 100%, 0 100%)', cursor: 'pointer', boxShadow: '0 0 36px rgba(109,40,217,0.5), 0 4px 20px rgba(0,0,0,0.4)', transition: 'opacity 0.15s' }}>
            LET'S ROLL →
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN: Plan
// ─────────────────────────────────────────────────────────────────────────────
function ScreenPlan({ dark, online, onTheme, theme }: { dark: boolean; online: boolean; onTheme: () => void; theme: Theme }) {
  const [mode, setMode] = useState('eskate')
  return (
    <div className="absolute inset-0">
      <CityMap dark={dark}/>
      {/* panel */}
      <div className="absolute inset-y-0 left-0 panel panel-violet-border flex flex-col clip-chamfer-tr" style={{ width: 384 }}>
        <RouteMotif opacity={0.12}/>
        <div className="relative flex flex-col flex-1 overflow-y-auto">
          <PanelHeader dark={dark} online={online} theme={theme} onTheme={onTheme}/>
          <TabBar active="plan" dark={dark}/>

          {/* stops */}
          <div style={{ padding: '16px 20px 12px' }}>
            <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 8, letterSpacing: '0.16em', color: dark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.38)', display: 'block', marginBottom: 10 }}>ROUTE STOPS</span>
            {/* stop chain with connector */}
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ position: 'absolute', left: 11, top: 36, bottom: 36, width: 1, background: 'linear-gradient(to bottom, rgba(139,92,246,0.6), rgba(34,211,238,0.6))', pointerEvents: 'none' }}/>
              {[
                { dot: '#8b5cf6', dotGlow: 'rgba(139,92,246,0.7)', val: 'Home · 14 Maple St', label: 'ORIGIN' },
                { dot: '#22d3ee', dotGlow: 'rgba(34,211,238,0.7)', val: 'Downtown Hub', label: 'DEST' },
              ].map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: s.dot, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 10px ${s.dotGlow}`, zIndex: 1 }}>
                    <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 8, fontWeight: 700, color: '#000' }}>{i === 0 ? 'A' : 'B'}</span>
                  </div>
                  <div style={{ flex: 1, background: dark ? 'rgba(255,255,255,0.055)' : 'rgba(0,0,0,0.045)', border: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.09)'}`, borderRadius: 8, padding: '8px 12px' }}>
                    <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 7, color: dark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.38)', letterSpacing: '0.1em', marginBottom: 2 }}>{s.label}</div>
                    <div style={{ fontFamily: 'var(--ff-body)', fontSize: 13, fontWeight: 500, color: dark ? '#f1f5f9' : '#0f172a' }}>{s.val}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button style={{ flex: 1, padding: '7px', fontFamily: 'var(--ff-mono)', fontSize: 8, letterSpacing: '0.1em', background: 'transparent', border: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, borderRadius: 6, cursor: 'pointer', color: dark ? 'rgba(255,255,255,0.38)' : 'rgba(0,0,0,0.38)' }}>+ ADD WAYPOINT</button>
              <button style={{ padding: '7px 12px', background: 'transparent', border: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, borderRadius: 6, cursor: 'pointer', color: dark ? 'rgba(255,255,255,0.38)' : 'rgba(0,0,0,0.38)', fontSize: 14 }}>⇅</button>
            </div>
          </div>

          {/* saved places */}
          <div style={{ padding: '0 20px 14px' }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[{ l: 'Home', emoji: '⌂' }, { l: 'Work', emoji: '◈' }, { l: 'Café', emoji: '◎' }, { l: 'Current', emoji: '●' }].map(p => (
                <button key={p.l} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: dark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.7)', border: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, borderRadius: 20, cursor: 'pointer' }}>
                  <span style={{ fontSize: 10, color: '#a78bfa' }}>{p.emoji}</span>
                  <span style={{ fontFamily: 'var(--ff-body)', fontSize: 11, color: dark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)' }}>{p.l}</span>
                </button>
              ))}
            </div>
          </div>

          <div style={{ height: 1, background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)', margin: '0 20px' }}/>

          {/* mode + board */}
          <div style={{ padding: '14px 20px 12px' }}>
            <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 8, letterSpacing: '0.16em', color: dark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.38)', display: 'block', marginBottom: 10 }}>TRANSPORT MODE</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {MODES.slice(0, 5).map(m => {
                const active = mode === m.id
                const c = m.electric ? '#8b5cf6' : '#60a5fa'
                return (
                  <button key={m.id} onClick={() => setMode(m.id)}
                    style={{ padding: '5px 12px', background: active ? (m.electric ? 'rgba(109,40,217,0.28)' : 'rgba(59,130,246,0.2)') : dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', border: `1px solid ${active ? c : dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, borderRadius: 6, cursor: 'pointer', fontFamily: 'var(--ff-body)', fontSize: 12, fontWeight: 500, color: active ? c : dark ? 'rgba(255,255,255,0.42)' : 'rgba(0,0,0,0.5)', transition: 'all 0.15s', boxShadow: active ? `0 0 10px ${c}44` : 'none' }}>
                    {m.label}
                  </button>
                )
              })}
            </div>

            {/* board preset */}
            <div style={{ marginTop: 12, background: dark ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.03)', border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`, borderRadius: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
                <div>
                  <div style={{ fontFamily: 'var(--ff-body)', fontSize: 13, fontWeight: 600, color: dark ? '#f1f5f9' : '#0f172a' }}>Meepo V5</div>
                  <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 8, color: '#8b5cf6', letterSpacing: '0.08em' }}>E-SKATE · 10 Ah</div>
                </div>
                <BattRing pct={82} color="#34d399" size={44}/>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0 }}>
                {[{ l: 'CLIMB', v: '25%', c: '#fbbf24' }, { l: 'BRAKING', v: 'Normal', c: '#a78bfa' }, { l: 'WEIGHT', v: '78 kg', c: dark ? '#f1f5f9' : '#0f172a' }].map((r, i) => (
                  <div key={r.l} style={{ padding: '8px 14px', borderRight: i < 2 ? `1px solid ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` : 'none' }}>
                    <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 7, letterSpacing: '0.12em', color: dark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.38)', marginBottom: 2 }}>{r.l}</div>
                    <div style={{ fontFamily: 'var(--ff-display)', fontWeight: 700, fontSize: 16, color: r.c }}>{r.v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CTAs */}
          <div style={{ padding: '0 20px 20px', marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <SlashBtn label="⚡  PLAN ROUTE" color="#7c3aed"/>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{ flex: 1, padding: '10px', fontFamily: 'var(--ff-display)', fontSize: 13, letterSpacing: '0.07em', fontWeight: 700, background: 'transparent', border: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, borderRadius: 8, cursor: 'pointer', color: dark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)' }}>
                ✏  DRAW ROUTE
              </button>
              <button style={{ flex: 1, padding: '10px', fontFamily: 'var(--ff-display)', fontSize: 13, letterSpacing: '0.07em', fontWeight: 700, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.22)', borderRadius: 8, cursor: 'pointer', color: '#f87171' }}>
                ● REC LIVE
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN: Verdict
// ─────────────────────────────────────────────────────────────────────────────
function ScreenVerdict({ dark, verdict, setVerdict }: { dark: boolean; verdict: Verdict; setVerdict: (v: Verdict) => void }) {
  const V = VC[verdict]
  const isStop = verdict === 'stop'
  const isFly  = verdict === 'fly'
  return (
    <div className="absolute inset-0" style={isStop ? { animation: 'stopFlash 0.75s ease-in-out infinite' } : {}}>
      <CityMap dark={dark} verdict={verdict} dimmed/>

      {/* verdict sub-selector (top center) */}
      <div style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6, zIndex: 10 }}>
        {(Object.keys(VC) as Verdict[]).map(v => (
          <button key={v} onClick={() => setVerdict(v)}
            style={{ padding: '6px 14px', fontFamily: 'var(--ff-display)', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', cursor: 'pointer', transition: 'all 0.18s',
              background: verdict === v ? VC[v].dim : dark ? 'rgba(6,6,14,0.75)' : 'rgba(240,244,255,0.85)',
              color: verdict === v ? VC[v].color : dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
              border: `1px solid ${verdict === v ? VC[v].border : dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
              backdropFilter: 'blur(12px)',
              clipPath: 'polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)',
            }}>{v === 'watchit' ? 'WATCH IT' : v.toUpperCase()}</button>
        ))}
      </div>

      {/* verdict panel */}
      <div className="absolute inset-y-0 left-0 panel flex flex-col overflow-y-auto"
        style={{ width: 420, border: `1px solid ${V.border}`, boxShadow: `0 0 60px ${V.dim}, 0 0 120px ${V.dim.replace('0.18','0.08').replace('0.15','0.06').replace('0.22','0.09')}` }}>
        <RouteMotif opacity={0.1}/>
        <div className="relative flex flex-col flex-1">
          <PanelHeader dark={dark}/>

          {/* THE VERDICT HERO ─ typography is the design */}
          <div style={{ padding: '28px 24px 20px', position: 'relative' }}>
            <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 8, letterSpacing: '0.2em', color: dark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.35)', display: 'block', marginBottom: 12 }}>ROUTE VERDICT</span>
            <div
              className={isFly ? 'anim-fly' : ''}
              style={{
                fontFamily: 'var(--ff-display)',
                fontWeight: 700,
                fontSize: verdict === 'fly' ? 54 : verdict === 'watchit' ? 60 : 88,
                lineHeight: 0.92,
                letterSpacing: verdict === 'fly' ? '-0.01em' : '-0.02em',
                color: V.color,
                textShadow: dark ? `0 0 40px ${V.glow}, 0 0 80px ${V.dim.replace('0.18','0.6').replace('0.15','0.5').replace('0.22','0.7')}` : 'none',
                marginBottom: 10,
              }}>
              {V.label}
            </div>
            {/* ruled line echoing route */}
            <div style={{ height: 2, background: `linear-gradient(90deg, ${V.color} 0%, transparent 100%)`, marginBottom: 10, maxWidth: 280 }}/>
            <p style={{ fontFamily: 'var(--ff-body)', fontSize: 12, color: dark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.55)', margin: 0, lineHeight: 1.5 }}>{V.sub}</p>
          </div>

          {/* Stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, padding: '0 24px 20px' }}>
            <Stat label="DISTANCE" value="4.2" unit="km" dark={dark} accent={V.color}/>
            <Stat label="TOTAL CLIMB" value="+38" unit="m" dark={dark}/>
            <Stat label="ENERGY USED" value={`${V.energy}`} unit="%" dark={dark} color={V.color} accent={V.color}/>
            <Stat label="BATTERY LEFT" value={`${V.batt}`} unit="%" dark={dark} color={isStop ? '#f87171' : undefined}/>
          </div>

          {/* ring + mode */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '0 24px 20px' }}>
            <BattRing pct={V.batt} color={V.color} size={76}/>
            <div>
              <div style={{ fontFamily: 'var(--ff-body)', fontSize: 12, color: dark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}>Meepo V5 · E-Skate</div>
              <VehicleESkate color={V.color} size={52}/>
            </div>
          </div>

          {/* elevation */}
          <div style={{ padding: '0 24px 20px' }}>
            <ElevProfile verdict={verdict} dark={dark}/>
          </div>

          {/* actions */}
          <div style={{ padding: '0 24px 24px', marginTop: 'auto', display: 'flex', gap: 8 }}>
            <SlashBtn label="SAVE" color="transparent" secondary/>
            {isStop
              ? <SlashBtn label="FIND SAFER ROUTE" color="#7c3aed"/>
              : <SlashBtn label={isFly ? '▶ LAUNCH RIDE' : '▶ START RIDE'} color={V.glow}/>
            }
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN: Live tracking
// ─────────────────────────────────────────────────────────────────────────────
function ScreenLive({ dark }: { dark: boolean }) {
  return (
    <div className="absolute inset-0">
      <CityMap dark={dark} live/>

      {/* top HUD band */}
      <div className="panel panel-cyan-border clip-chamfer-bl" style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 0, overflow: 'hidden' }}>
        {[
          { l: 'REMAINING', v: '2.8', u: 'km', c: '#22d3ee' },
          { l: 'ELAPSED',   v: '08:42', u: '',     c: '#f1f5f9' },
          { l: 'SPEED',     v: '24',  u: 'km/h', c: '#f1f5f9' },
          { l: 'BATTERY',   v: '68',  u: '%',    c: '#34d399' },
          { l: 'GPS',       v: '±4',  u: 'm',    c: 'rgba(255,255,255,0.35)' },
        ].map((s, i) => (
          <div key={s.l} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 18px', borderRight: i < 4 ? `1px solid ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` : 'none' }}>
            <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 7, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.32)', marginBottom: 2 }}>{s.l}</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
              <span style={{ fontFamily: 'var(--ff-display)', fontWeight: 700, fontSize: 20, lineHeight: 1, color: s.c }}>{s.v}</span>
              {s.u && <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 8, color: 'rgba(255,255,255,0.35)' }}>{s.u}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* bottom controls */}
      <div className="panel panel-violet-border" style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 0, overflow: 'hidden', borderRadius: 14 }}>
        {[
          { sym: '⏸', lbl: 'PAUSE',    c: 'rgba(255,255,255,0.65)' },
          { sym: '⊙', lbl: 'RECENTER', c: 'rgba(255,255,255,0.65)' },
          { sym: '⏹', lbl: 'STOP',     c: '#f87171' },
          { sym: '✓', lbl: 'FINISH',   c: '#a78bfa', bg: 'rgba(139,92,246,0.25)' },
        ].map((b, i) => (
          <button key={b.lbl} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '12px 20px', background: b.bg ?? 'transparent', border: 'none', borderRight: i < 3 ? '1px solid rgba(255,255,255,0.07)' : 'none', cursor: 'pointer' }}>
            <span style={{ fontSize: 20, color: b.c }}>{b.sym}</span>
            <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 7, letterSpacing: '0.1em', color: b.c, opacity: 0.85 }}>{b.lbl}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN: Recording HUD
// ─────────────────────────────────────────────────────────────────────────────
function ScreenRecord({ dark }: { dark: boolean }) {
  return (
    <div className="absolute inset-0">
      <CityMap dark={dark} live/>

      {/* REC indicator */}
      <div style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 10, zIndex: 10 }}>
        <div className="panel" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', border: '1px solid rgba(239,68,68,0.45)', borderRadius: 8 }}>
          <div className="anim-rec" style={{ width: 9, height: 9, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 10px rgba(239,68,68,0.9)' }}/>
          <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 11, fontWeight: 700, color: '#f87171', letterSpacing: '0.14em' }}>REC</span>
          <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 11, color: '#f1f5f9', letterSpacing: '0.05em' }}>12:34</span>
        </div>
      </div>

      {/* stats strip */}
      <div className="panel panel-violet-border clip-chamfer-tr" style={{ position: 'absolute', top: 58, left: 16, display: 'flex', flexDirection: 'column', gap: 0 }}>
        {[
          { l: 'DISTANCE',    v: '1.8', u: 'km',   c: '#f1f5f9' },
          { l: 'DURATION',    v: '12:34', u: '',   c: '#f1f5f9' },
          { l: 'SPEED',       v: '21', u: 'km/h', c: '#22d3ee' },
          { l: 'BATT DELTA',  v: '−11', u: '%',   c: '#fbbf24' },
        ].map((s, i) => (
          <div key={s.l} style={{ padding: '10px 16px', borderBottom: i < 3 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
            <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 7, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.3)', marginBottom: 2 }}>{s.l}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
              <span style={{ fontFamily: 'var(--ff-display)', fontWeight: 700, fontSize: 22, color: s.c, lineHeight: 1 }}>{s.v}</span>
              {s.u && <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 8, color: 'rgba(255,255,255,0.35)' }}>{s.u}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* stop recording button */}
      <div style={{ position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)' }}>
        <button style={{ padding: '14px 40px', fontFamily: 'var(--ff-display)', fontWeight: 700, fontSize: 16, letterSpacing: '0.08em', color: '#fff', background: 'linear-gradient(135deg, #dc2626, #b91c1c)', border: '1px solid rgba(239,68,68,0.5)', clipPath: 'polygon(12px 0, 100% 0, calc(100% - 12px) 100%, 0 100%)', cursor: 'pointer', boxShadow: '0 0 30px rgba(220,38,38,0.45)' }}>
          ■  STOP RECORDING
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN: Saved trips
// ─────────────────────────────────────────────────────────────────────────────
function ScreenSaved({ dark }: { dark: boolean }) {
  return (
    <div className="absolute inset-0 flex flex-col" style={{ background: dark ? 'linear-gradient(160deg, #06060e 0%, #0b0b1c 100%)' : 'linear-gradient(160deg, #eff6ff 0%, #f8fafc 100%)' }}>
      <div style={{ position: 'relative' }}>
        <RouteMotif opacity={0.08}/>
        <PanelHeader dark={dark}/>
        <TabBar active="saved" dark={dark}/>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 8, letterSpacing: '0.16em', color: dark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.38)' }}>SAVED TRIPS · {SAVED.length}</span>
        {SAVED.map((trip, i) => {
          const V = VC[trip.verdict]
          const M = MODES.find(m => m.id === trip.mode)!
          return (
            <div key={i} className="clip-chamfer-tr" style={{ background: dark ? 'rgba(255,255,255,0.038)' : 'rgba(255,255,255,0.9)', border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`, padding: '14px 16px', cursor: 'pointer', transition: 'all 0.18s', boxShadow: dark ? 'none' : '0 2px 12px rgba(0,0,0,0.06)' }}>
              {/* top row */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                <div>
                  <div style={{ fontFamily: 'var(--ff-display)', fontWeight: 700, fontSize: 17, letterSpacing: '0.01em', color: dark ? '#f1f5f9' : '#0f172a', lineHeight: 1, marginBottom: 3 }}>{trip.name}</div>
                  <div style={{ fontFamily: 'var(--ff-body)', fontSize: 11, color: dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.45)' }}>{trip.from} → {trip.to}</div>
                </div>
                {/* verdict badge */}
                <div style={{ padding: '4px 10px', fontFamily: 'var(--ff-display)', fontWeight: 700, fontSize: 11, letterSpacing: '0.1em', color: V.color, background: V.dim, border: `1px solid ${V.border}`, clipPath: 'polygon(6px 0, 100% 0, calc(100% - 6px) 100%, 0 100%)' }}>
                  {trip.verdict === 'watchit' ? 'WATCH IT' : trip.verdict.toUpperCase()}
                </div>
              </div>

              {/* stats + ring + mode mark + actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <BattRing pct={trip.batt} color={V.color} size={46}/>
                {/* mini route path */}
                <svg width="48" height="32" viewBox="0 0 48 32" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M4 28 Q 10 22 16 17 Q 24 12 32 8 Q 38 5 44 4"
                    fill="none" stroke={V.color} strokeWidth="2" strokeLinecap="round"
                    style={dark ? { filter: `drop-shadow(0 0 4px ${V.glow})` } : {}}/>
                  <circle cx="4"  cy="28" r="3" fill="#8b5cf6"/>
                  <circle cx="44" cy="4"  r="3" fill="#22d3ee"/>
                </svg>
                <div style={{ display: 'flex', gap: 14, flex: 1 }}>
                  {[{ l: 'DIST', v: `${trip.dist} km` }, { l: 'CLIMB', v: `${trip.climb} m` }, { l: 'DATE', v: trip.date }].map(s => (
                    <div key={s.l}>
                      <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 7, letterSpacing: '0.1em', color: dark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.38)', marginBottom: 2 }}>{s.l}</div>
                      <div style={{ fontFamily: 'var(--ff-display)', fontWeight: 700, fontSize: 14, color: dark ? '#f1f5f9' : '#0f172a' }}>{s.v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <button style={{ padding: '5px 12px', fontFamily: 'var(--ff-display)', fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', background: 'rgba(34,211,238,0.12)', border: '1px solid rgba(34,211,238,0.3)', color: '#22d3ee', cursor: 'pointer', clipPath: 'polygon(5px 0, 100% 0, calc(100% - 5px) 100%, 0 100%)' }}>▶ REPLAY</button>
                  <button style={{ padding: '5px 12px', fontFamily: 'var(--ff-display)', fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', cursor: 'pointer', clipPath: 'polygon(5px 0, 100% 0, calc(100% - 5px) 100%, 0 100%)' }}>✕ DELETE</button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN: States (loading / empty / error / online / offline)
// ─────────────────────────────────────────────────────────────────────────────
function ScreenStates({ dark }: { dark: boolean }) {
  const textColor = dark ? '#f1f5f9' : '#0f172a'
  const sub = dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.45)'
  const bg = dark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.8)'
  const bd = dark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.09)'

  const StateCard = ({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) => (
    <div className="clip-chamfer-tr" style={{ background: bg, border: `1px solid ${bd}`, padding: '18px 18px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 8, letterSpacing: '0.16em', color: accent }}>{title}</div>
      {children}
    </div>
  )

  return (
    <div className="absolute inset-0 overflow-y-auto" style={{ background: dark ? 'linear-gradient(160deg, #06060e 0%, #0b0b1c 100%)' : 'linear-gradient(160deg, #eff6ff 0%, #f8fafc 100%)' }}>
      <div style={{ padding: '20px', maxWidth: 900, margin: '0 auto' }}>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontFamily: 'var(--ff-display)', fontSize: 28, fontWeight: 700, color: textColor, margin: 0, letterSpacing: '-0.01em' }}>System States</h2>
          <p style={{ fontFamily: 'var(--ff-mono)', fontSize: 9, color: sub, letterSpacing: '0.12em', margin: '4px 0 0' }}>LOADING · EMPTY · ERROR · ONLINE · OFFLINE</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>

          {/* Loading */}
          <StateCard title="LOADING STATE" accent="#a78bfa">
            <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 8, background: dark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.06)', height: 80 }}>
              <div className="absolute inset-0" style={{ backgroundImage: dark ? 'linear-gradient(rgba(139,92,246,0.07) 1px,transparent 1px),linear-gradient(90deg,rgba(139,92,246,0.07) 1px,transparent 1px)' : 'linear-gradient(rgba(96,165,250,0.12) 1px,transparent 1px),linear-gradient(90deg,rgba(96,165,250,0.12) 1px,transparent 1px)', backgroundSize: '24px 24px' }}/>
              {/* scanning line */}
              <div style={{ position: 'absolute', left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, #8b5cf6, #22d3ee, transparent)', boxShadow: '0 0 10px rgba(139,92,246,0.7)', animation: 'scanLine 1.8s ease-in-out infinite' }}/>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--ff-display)', fontSize: 16, fontWeight: 700, color: textColor, marginBottom: 4 }}>Routing your trip…</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {[{ l: 'Geocoding stops', done: true }, { l: 'Building route legs', done: true }, { l: 'Fetching elevation data', done: false }, { l: 'Scoring gradients', done: false }].map((step, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 14, height: 14, borderRadius: '50%', border: `1.5px solid ${step.done ? '#8b5cf6' : dark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'}`, background: step.done ? '#8b5cf6' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {step.done && <span style={{ color: '#fff', fontSize: 8 }}>✓</span>}
                      {!step.done && i === 2 && <div className="anim-rec" style={{ width: 5, height: 5, borderRadius: '50%', background: '#a78bfa' }}/>}
                    </div>
                    <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 9, color: step.done ? sub : i === 2 ? '#a78bfa' : dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.25)' }}>{step.l}</span>
                  </div>
                ))}
              </div>
            </div>
          </StateCard>

          {/* Empty */}
          <StateCard title="EMPTY STATE" accent="#60a5fa">
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 10, padding: '8px 0' }}>
              {/* ghost route illustration */}
              <svg width="80" height="50" viewBox="0 0 80 50" fill="none">
                <path d="M8 44 Q 16 36 24 28 Q 36 18 48 12 Q 60 6 72 4"
                  stroke={dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'} strokeWidth="2.5" strokeLinecap="round" strokeDasharray="5 4"/>
                <circle cx="8" cy="44" r="5" stroke={dark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'} strokeWidth="2" fill="none"/>
                <circle cx="72" cy="4" r="5" stroke={dark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'} strokeWidth="2" fill="none"/>
              </svg>
              <div style={{ fontFamily: 'var(--ff-display)', fontSize: 16, fontWeight: 700, color: textColor }}>No saved trips yet</div>
              <p style={{ fontFamily: 'var(--ff-body)', fontSize: 12, color: sub, margin: 0, lineHeight: 1.5 }}>Plan your first route and save it for offline replay</p>
              <button style={{ padding: '8px 20px', fontFamily: 'var(--ff-display)', fontSize: 12, fontWeight: 700, letterSpacing: '0.07em', color: '#fff', background: '#7c3aed', border: 'none', clipPath: 'polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)', cursor: 'pointer' }}>PLAN A ROUTE</button>
            </div>
          </StateCard>

          {/* Error */}
          <StateCard title="ERROR STATE" accent="#f87171">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', items: 'center', gap: 10, padding: '10px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8 }}>
                <div style={{ width: 3, background: '#ef4444', alignSelf: 'stretch', borderRadius: 2, flexShrink: 0 }}/>
                <div>
                  <div style={{ fontFamily: 'var(--ff-display)', fontSize: 14, fontWeight: 700, color: '#f87171', marginBottom: 2 }}>Routing failed</div>
                  <div style={{ fontFamily: 'var(--ff-body)', fontSize: 11, color: sub }}>Could not fetch elevation data for this route. Check your connection and try again.</div>
                </div>
              </div>
              <button style={{ padding: '8px 0', fontFamily: 'var(--ff-display)', fontSize: 12, fontWeight: 700, letterSpacing: '0.07em', color: '#f87171', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, cursor: 'pointer' }}>↺  RETRY</button>
            </div>
          </StateCard>

          {/* Online */}
          <StateCard title="ONLINE STATE" accent="#34d399">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 8px rgba(52,211,153,0.7)' }}/>
                <span style={{ fontFamily: 'var(--ff-display)', fontSize: 16, fontWeight: 700, color: '#34d399' }}>Connected</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                {[{ l: 'Map tiles', v: 'Live' }, { l: 'Elevation', v: 'Live' }, { l: 'Geocoding', v: 'Live' }, { l: 'Sync', v: 'Up to date' }].map(r => (
                  <div key={r.l} style={{ padding: '6px 10px', background: 'rgba(52,211,153,0.08)', borderRadius: 6, border: '1px solid rgba(52,211,153,0.2)' }}>
                    <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 7, color: sub, letterSpacing: '0.1em' }}>{r.l}</div>
                    <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, fontWeight: 600, color: '#34d399' }}>{r.v}</div>
                  </div>
                ))}
              </div>
            </div>
          </StateCard>

          {/* Offline */}
          <StateCard title="OFFLINE STATE" accent="#f59e0b">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#f59e0b', boxShadow: '0 0 8px rgba(245,158,11,0.7)' }}/>
              <span style={{ fontFamily: 'var(--ff-display)', fontSize: 16, fontWeight: 700, color: '#fbbf24' }}>Offline Mode</span>
            </div>
            <div style={{ padding: '10px 12px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8 }}>
              <div style={{ fontFamily: 'var(--ff-body)', fontSize: 11, color: sub, marginBottom: 8 }}>4 saved trips available · Live routing unavailable</div>
              {SAVED.slice(0, 2).map((t, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0', borderTop: i > 0 ? `1px solid ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` : 'none' }}>
                  <span style={{ fontFamily: 'var(--ff-body)', fontSize: 11, color: textColor }}>{t.name}</span>
                  <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 8, color: '#fbbf24', background: 'rgba(245,158,11,0.15)', padding: '2px 6px', borderRadius: 4 }}>CACHED</span>
                </div>
              ))}
            </div>
          </StateCard>

          {/* Desktop note */}
          <StateCard title="DESKTOP LAYOUT" accent="#a78bfa">
            <div style={{ fontFamily: 'var(--ff-body)', fontSize: 12, color: sub, lineHeight: 1.6 }}>
              On desktop: full-screen map left · 420 px panel right, fixed. Stats visible at a glance. Panel uses the same grid; no collapsed states.
            </div>
            <div style={{ display: 'flex', gap: 4, opacity: 0.7 }}>
              <div style={{ flex: 3, height: 40, background: dark ? 'rgba(139,92,246,0.1)' : 'rgba(96,165,250,0.15)', border: `1px solid ${dark ? 'rgba(139,92,246,0.2)' : 'rgba(96,165,250,0.25)'}`, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 8, color: dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.4)' }}>MAP</span>
              </div>
              <div style={{ flex: 1, height: 40, background: dark ? 'rgba(139,92,246,0.2)' : 'rgba(124,58,237,0.12)', border: `1px solid ${dark ? 'rgba(139,92,246,0.4)' : 'rgba(124,58,237,0.3)'}`, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 8, color: dark ? '#a78bfa' : '#7c3aed' }}>PANEL</span>
              </div>
            </div>
          </StateCard>

        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN: Desktop composition
// ─────────────────────────────────────────────────────────────────────────────
function ScreenDesktop({ dark, verdict, setVerdict }: { dark: boolean; verdict: Verdict; setVerdict: (v: Verdict) => void }) {
  const V = VC[verdict]
  return (
    <div className="absolute inset-0 flex">
      {/* map fills left */}
      <CityMap dark={dark} verdict={verdict} dimmed/>

      {/* fixed right panel */}
      <div className="absolute inset-y-0 right-0 panel panel-violet-border flex flex-col overflow-y-auto clip-chamfer-tl" style={{ width: 420, borderLeft: `1px solid ${V.border}`, boxShadow: `0 0 60px ${V.dim}` }}>
        <RouteMotif opacity={0.1}/>
        <div className="relative flex flex-col flex-1">
          <PanelHeader dark={dark}/>
          <TabBar active="plan" dark={dark}/>

          {/* verdict sub-selector */}
          <div style={{ display: 'flex', gap: 6, padding: '12px 20px 4px', flexWrap: 'wrap' }}>
            {(Object.keys(VC) as Verdict[]).map(v => (
              <button key={v} onClick={() => setVerdict(v)}
                style={{ padding: '5px 12px', fontFamily: 'var(--ff-display)', fontSize: 12, fontWeight: 700, letterSpacing: '0.07em', cursor: 'pointer', transition: 'all 0.18s',
                  background: verdict === v ? VC[v].dim : 'transparent',
                  color: verdict === v ? VC[v].color : dark ? 'rgba(255,255,255,0.38)' : 'rgba(0,0,0,0.38)',
                  border: `1px solid ${verdict === v ? VC[v].border : dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                  clipPath: 'polygon(6px 0, 100% 0, calc(100% - 6px) 100%, 0 100%)',
                }}>{v === 'watchit' ? 'WATCH IT' : v.toUpperCase()}</button>
            ))}
          </div>

          {/* verdict hero */}
          <div style={{ padding: '20px 24px 14px', borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
            <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 8, letterSpacing: '0.18em', color: dark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.35)', marginBottom: 10 }}>ROUTE VERDICT</div>
            <div className={verdict === 'fly' ? 'anim-fly' : verdict === 'stop' ? 'anim-stop' : ''}
              style={{ fontFamily: 'var(--ff-display)', fontWeight: 700, fontSize: verdict === 'fly' ? 48 : verdict === 'watchit' ? 54 : 80, lineHeight: 0.92, letterSpacing: '-0.02em', color: V.color, textShadow: dark ? `0 0 40px ${V.glow}` : 'none', marginBottom: 8 }}>
              {V.label}
            </div>
            <div style={{ height: 2, background: `linear-gradient(90deg, ${V.color} 0%, transparent 100%)`, marginBottom: 8, maxWidth: 260 }}/>
            <p style={{ fontFamily: 'var(--ff-body)', fontSize: 12, color: dark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', margin: 0 }}>{V.sub}</p>
          </div>

          {/* stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, padding: '16px 24px' }}>
            <Stat label="DISTANCE" value="4.2" unit="km" dark={dark} accent={V.color}/>
            <Stat label="CLIMB" value="+38" unit="m" dark={dark}/>
            <Stat label="ENERGY" value={`${V.energy}`} unit="%" dark={dark} color={V.color} accent={V.color}/>
            <Stat label="BATTERY" value={`${V.batt}`} unit="%" dark={dark} color={verdict === 'stop' ? '#f87171' : undefined}/>
          </div>

          {/* ring + vehicle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '0 24px 16px' }}>
            <BattRing pct={V.batt} color={V.color} size={68}/>
            <VehicleESkate color={V.color} size={56}/>
            <div>
              <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 9, letterSpacing: '0.1em', color: V.color, fontWeight: 600 }}>E-SKATE · MEEPO V5</div>
              <div style={{ fontFamily: 'var(--ff-body)', fontSize: 11, color: dark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)' }}>10 Ah · 78 kg rider</div>
            </div>
          </div>

          {/* elevation */}
          <div style={{ padding: '0 24px 20px' }}>
            <ElevProfile verdict={verdict} dark={dark}/>
          </div>

          {/* actions */}
          <div style={{ padding: '0 24px 28px', marginTop: 'auto', display: 'flex', gap: 8 }}>
            <SlashBtn label="SAVE" color="transparent" secondary/>
            {verdict !== 'stop'
              ? <SlashBtn label="▶ START RIDE" color={V.glow}/>
              : <SlashBtn label="FIND SAFER ROUTE" color="#7c3aed"/>
            }
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT APP
// ─────────────────────────────────────────────────────────────────────────────
const NAV: { id: Screen; label: string }[] = [
  { id: 'onboard', label: 'Onboard'  },
  { id: 'plan',    label: 'Plan'     },
  { id: 'verdict', label: 'Verdict'  },
  { id: 'live',    label: 'Live'     },
  { id: 'record',  label: 'Record'   },
  { id: 'saved',   label: 'Saved'    },
  { id: 'states',  label: 'States'   },
  { id: 'desktop', label: 'Desktop'  },
]

export default function App() {
  const [screen,  setScreen]  = useState<Screen>('onboard')
  const [verdict, setVerdict] = useState<Verdict>('fly')
  const [theme,   setTheme]   = useState<Theme>('night')
  const [online,  setOnline]  = useState(true)

  const dark = theme === 'night'

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#04040b', fontFamily: 'var(--ff-body)' }}>
      {/* nav */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'rgba(4,4,14,0.97)', borderBottom: '1px solid rgba(139,92,246,0.18)', backdropFilter: 'blur(16px)', zIndex: 50, flexWrap: 'wrap' }}>
        {/* brand */}
        <span style={{ fontFamily: 'var(--ff-display)', fontWeight: 700, fontSize: 14, background: 'linear-gradient(130deg, #a78bfa, #22d3ee)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginRight: 6, flexShrink: 0 }}>GR</span>

        {/* screen tabs */}
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {NAV.map(n => (
            <button key={n.id} onClick={() => setScreen(n.id)}
              style={{ padding: '5px 12px', fontFamily: 'var(--ff-body)', fontSize: 11, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s',
                background: screen === n.id ? 'rgba(139,92,246,0.22)' : 'rgba(255,255,255,0.04)',
                color: screen === n.id ? '#a78bfa' : 'rgba(255,255,255,0.38)',
                border: `1px solid ${screen === n.id ? 'rgba(139,92,246,0.45)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 6,
              }}>{n.label}</button>
          ))}
        </div>

        <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.1)', margin: '0 4px' }}/>

        {/* theme toggle */}
        <button onClick={() => setTheme(t => t === 'night' ? 'day' : 'night')}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', fontFamily: 'var(--ff-mono)', fontSize: 9, letterSpacing: '0.1em', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: theme === 'night' ? '#a78bfa' : '#fbbf24', borderRadius: 6, cursor: 'pointer' }}>
          <span>{theme === 'night' ? '☾' : '☀'}</span>
          <span>{theme === 'night' ? 'NIGHTRIDE' : 'MIDDAY'}</span>
        </button>

        {/* online toggle */}
        <button onClick={() => setOnline(o => !o)}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', fontFamily: 'var(--ff-mono)', fontSize: 9, letterSpacing: '0.1em', background: online ? 'rgba(52,211,153,0.1)' : 'rgba(148,163,184,0.1)', border: `1px solid ${online ? 'rgba(52,211,153,0.3)' : 'rgba(148,163,184,0.25)'}`, color: online ? '#34d399' : '#94a3b8', borderRadius: 6, cursor: 'pointer' }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: online ? '#34d399' : '#94a3b8' }}/>
          <span>{online ? 'ONLINE' : 'OFFLINE'}</span>
        </button>

        <span style={{ marginLeft: 'auto', fontFamily: 'var(--ff-mono)', fontSize: 8, color: 'rgba(255,255,255,0.18)', letterSpacing: '0.12em', flexShrink: 0 }}>GRADIENTRIP  ·  ELECTRIC ARCADE</span>
      </div>

      {/* screen */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {screen === 'onboard'  && <ScreenOnboard dark={dark}/>}
        {screen === 'plan'     && <ScreenPlan    dark={dark} online={online} theme={theme} onTheme={() => setTheme(t => t === 'night' ? 'day' : 'night')}/>}
        {screen === 'verdict'  && <ScreenVerdict dark={dark} verdict={verdict} setVerdict={setVerdict}/>}
        {screen === 'live'     && <ScreenLive    dark={dark}/>}
        {screen === 'record'   && <ScreenRecord  dark={dark}/>}
        {screen === 'saved'    && <ScreenSaved   dark={dark}/>}
        {screen === 'states'   && <ScreenStates  dark={dark}/>}
        {screen === 'desktop'  && <ScreenDesktop dark={dark} verdict={verdict} setVerdict={setVerdict}/>}
      </div>
    </div>
  )
}

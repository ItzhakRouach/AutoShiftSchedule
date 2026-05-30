// theme.jsx — design tokens + theme presets (drives the visual-style Tweaks)

// Fixed semantic colors for roles & shifts (consistent across themes)
const ROLE_META = {
  'אחמ״ש':  { color: '#E0902A', soft: 'rgba(224,144,42,0.14)', short: 'אחמ״ש' },
  'מוקדן':  { color: '#3D6BF5', soft: 'rgba(61,107,245,0.14)', short: 'מוקדן' },
  'מאבטח':  { color: '#13A98E', soft: 'rgba(19,169,142,0.14)', short: 'מאבטח' },
};
const ROLES = ['אחמ״ש', 'מוקדן', 'מאבטח'];

const SHIFT_META = {
  morning: { id: 'morning', name: 'בוקר',   time: '07:00–15:00', start: 7,  hours: 8, color: '#F2A93B', soft: 'rgba(242,169,59,0.13)', icon: 'sun' },
  noon:    { id: 'noon',    name: 'צהריים', time: '15:00–23:00', start: 15, hours: 8, color: '#EB6A4E', soft: 'rgba(235,106,78,0.13)', icon: 'sunset' },
  night:   { id: 'night',   name: 'לילה',   time: '23:00–07:00', start: 23, hours: 8, color: '#5B61D6', soft: 'rgba(91,97,214,0.15)', icon: 'moon' },
};
const SHIFT_ORDER = ['morning', 'noon', 'night'];

// Accent presets
const ACCENTS = {
  indigo: '#3457F0',
  blue:   '#2563EB',
  teal:   '#0E9E8C',
  violet: '#6D4BE0',
};

// Theme presets — each maps to a full set of CSS custom props
const THEMES = {
  light: {
    name: 'בהיר',
    vars: {
      '--bg': '#EEF0F4',
      '--surface': '#FFFFFF',
      '--surface-2': '#F7F8FA',
      '--surface-sunk': '#F0F2F6',
      '--text': '#13161D',
      '--text-2': '#5A6271',
      '--text-3': '#9097A4',
      '--border': '#E6E8EE',
      '--border-strong': '#D7DAE2',
      '--shadow': '0 1px 2px rgba(20,24,32,0.04), 0 6px 20px rgba(20,24,32,0.06)',
      '--shadow-lift': '0 8px 30px rgba(20,24,32,0.12)',
      '--chrome': 'rgba(255,255,255,0.82)',
      '--scrim': 'rgba(20,24,32,0.42)',
    },
    statusDark: false,
  },
  dark: {
    name: 'כהה',
    vars: {
      '--bg': '#0C0F15',
      '--surface': '#161A22',
      '--surface-2': '#1C212B',
      '--surface-sunk': '#11151C',
      '--text': '#F1F3F8',
      '--text-2': '#9BA3B2',
      '--text-3': '#69707E',
      '--border': '#252B36',
      '--border-strong': '#323a48',
      '--shadow': '0 1px 2px rgba(0,0,0,0.4), 0 8px 24px rgba(0,0,0,0.35)',
      '--shadow-lift': '0 12px 36px rgba(0,0,0,0.55)',
      '--chrome': 'rgba(18,22,29,0.82)',
      '--scrim': 'rgba(0,0,0,0.6)',
    },
    statusDark: true,
  },
  warm: {
    name: 'חמים',
    vars: {
      '--bg': '#F2ECE2',
      '--surface': '#FFFCF7',
      '--surface-2': '#F8F2E9',
      '--surface-sunk': '#EDE5D8',
      '--text': '#2A241C',
      '--text-2': '#736A5C',
      '--text-3': '#A89E8D',
      '--border': '#E8DFD0',
      '--border-strong': '#DACDB8',
      '--shadow': '0 1px 2px rgba(80,60,30,0.05), 0 6px 20px rgba(80,60,30,0.07)',
      '--shadow-lift': '0 10px 32px rgba(80,60,30,0.16)',
      '--chrome': 'rgba(255,252,247,0.85)',
      '--scrim': 'rgba(50,40,25,0.4)',
    },
    statusDark: false,
  },
};

const FONTS = {
  assistant: "'Assistant', system-ui, sans-serif",
  rubik: "'Rubik', system-ui, sans-serif",
  heebo: "'Heebo', system-ui, sans-serif",
};

const RADII = {
  soft:  { '--r-lg': '22px', '--r-md': '16px', '--r-sm': '11px', '--r-pill': '999px' },
  sharp: { '--r-lg': '12px', '--r-md': '9px',  '--r-sm': '6px',  '--r-pill': '999px' },
};

// Build the full inline style (CSS variables) for the app root
function buildThemeVars(t) {
  const theme = THEMES[t.theme] || THEMES.light;
  const radii = RADII[t.corners] || RADII.soft;
  return {
    ...theme.vars,
    ...radii,
    '--accent': ACCENTS[t.accent] || ACCENTS.indigo,
    '--accent-soft': hexToSoft(ACCENTS[t.accent] || ACCENTS.indigo, t.theme === 'dark' ? 0.2 : 0.12),
    '--accent-ink': '#FFFFFF',
    '--font': FONTS[t.font] || FONTS.assistant,
    fontFamily: FONTS[t.font] || FONTS.assistant,
  };
}

function hexToSoft(hex, a) {
  const n = hex.replace('#', '');
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

Object.assign(window, {
  ROLE_META, ROLES, SHIFT_META, SHIFT_ORDER, ACCENTS, THEMES, FONTS, RADII,
  buildThemeVars, hexToSoft,
});

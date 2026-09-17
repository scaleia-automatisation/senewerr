import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:        'var(--bg)',
        surface:   'var(--surface)',
        'surface-2': 'var(--surface-2)',
        ink:       'var(--ink)',
        'ink-2':   'var(--ink-2)',
        'ink-3':   'var(--ink-3)',
        line:      'var(--line)',
        primary: {
          DEFAULT: 'var(--primary)',
          hover:   'var(--primary-hover)',
          soft:    'var(--primary-soft)',
          fg:      'var(--primary-fg)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          soft:    'var(--accent-soft)',
          fg:      'var(--accent-fg)',
        },
        status: {
          success:  'var(--status-success)',
          pending:  'var(--status-pending)',
          progress: 'var(--status-progress)',
          danger:   'var(--status-danger)',
          neutral:  'var(--status-neutral)',
        },
        navy: {
          DEFAULT: 'var(--navy)',
          soft:    'var(--navy-soft)',
        },
        cyan: 'var(--cyan)',
      },
      backgroundImage: {
        'gradient-hero':  'var(--gradient-hero)',
        'gradient-teal':  'var(--gradient-teal)',
        'gradient-green': 'var(--gradient-green)',
      },
      fontFamily: {
        display: ['Poppins', 'system-ui', 'sans-serif'],
        sans:    ['"Inter Variable"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        micro:   ['12px', { lineHeight: '1.4' }],
        small:   ['14px', { lineHeight: '1.45' }],
        body:    ['16px', { lineHeight: '1.55' }],
        h3:      ['clamp(17px, 2vw, 19px)', { lineHeight: '1.3' }],
        h2:      ['clamp(20px, 3vw, 24px)', { lineHeight: '1.2' }],
        h1:      ['clamp(26px, 4vw, 34px)', { lineHeight: '1.15' }],
        display: ['clamp(32px, 6vw, 44px)', { lineHeight: '1.1' }],
      },
      spacing: {
        's-1': 'var(--s-1)', 's-2': 'var(--s-2)', 's-3': 'var(--s-3)', 's-4': 'var(--s-4)',
        's-5': 'var(--s-5)', 's-6': 'var(--s-6)', 's-7': 'var(--s-7)', 's-8': 'var(--s-8)',
      },
      borderRadius: {
        sm:   'var(--r-sm)',
        md:   'var(--r-md)',
        lg:   'var(--r-lg)',
        pill: 'var(--r-pill)',
      },
      boxShadow: {
        1:     'var(--shadow-1)',
        2:     'var(--shadow-2)',
        focus: 'var(--shadow-focus)',
      },
      transitionTimingFunction: {
        out: 'var(--ease-out)',
      },
      transitionDuration: {
        fast: '140ms',
        base: '220ms',
        slow: '320ms',
      },
      maxWidth: {
        container: '1200px',
        admin:     '1440px',
      },
      keyframes: {
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-4px)' },
          '75%': { transform: 'translateX(4px)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
      animation: {
        shake:   'shake 200ms var(--ease-out) 2',
        shimmer: 'shimmer 1.2s infinite',
        'fade-in': 'fade-in 220ms var(--ease-out)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config

export interface ThemeColors {
  primary: string;
  accent: string;
  background: string;
  cardBackground: string;
  text: string;
  mutedText: string;
  border: string;
  success: string;
  warning: string;
  error: string;
}

export interface ThemeFonts {
  heading: string;
  body: string;
}

export interface ThemeBranding {
  logoUrl?: string;
  backgroundImage?: string;
  backgroundColor?: string;
}

export interface ThemeSettings {
  colors: ThemeColors;
  borderRadius: 'small' | 'medium' | 'large';
  fonts: ThemeFonts;
  branding?: ThemeBranding;
}

export const defaultTheme: ThemeSettings = {
  colors: {
    primary: '#35a9ad',
    accent: '#4cf2f7',
    background: '#f9f9f9',
    cardBackground: '#ffffff',
    text: '#1a1a1a',
    mutedText: '#737373',
    border: '#e5e5e5',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444'
  },
  borderRadius: 'medium',
  fonts: {
    heading: 'Inter',
    body: 'Inter'
  },
  branding: {
    logoUrl: '',
    backgroundImage: '',
    backgroundColor: ''
  }
};

export const availableFonts = {
  heading: [
    { value: 'Inter', label: 'Inter' },
    { value: 'Poppins', label: 'Poppins' },
    { value: 'Roboto', label: 'Roboto' },
    { value: 'Montserrat', label: 'Montserrat' },
    { value: 'Playfair Display', label: 'Playfair Display' },
    { value: 'Outfit', label: 'Outfit' },
    { value: 'Oswald', label: 'Oswald' },
    { value: 'Raleway', label: 'Raleway' },
    { value: 'Merriweather', label: 'Merriweather' },
    { value: 'Bebas Neue', label: 'Bebas Neue' },
    { value: 'Archivo Black', label: 'Archivo Black' },
    { value: 'Josefin Sans', label: 'Josefin Sans' },
    { value: 'Quicksand', label: 'Quicksand' },
    { value: 'Nunito', label: 'Nunito' },
    { value: 'Rubik', label: 'Rubik' },
    { value: 'Work Sans', label: 'Work Sans' },
    { value: 'DM Sans', label: 'DM Sans' },
    { value: 'Space Grotesk', label: 'Space Grotesk' },
    { value: 'Figtree', label: 'Figtree' },
    { value: 'Plus Jakarta Sans', label: 'Plus Jakarta Sans' },
    { value: 'Manrope', label: 'Manrope' },
  ],
  body: [
    { value: 'Inter', label: 'Inter' },
    { value: 'Open Sans', label: 'Open Sans' },
    { value: 'Roboto', label: 'Roboto' },
    { value: 'Lato', label: 'Lato' },
    { value: 'Source Sans 3', label: 'Source Sans' },
    { value: 'Poppins', label: 'Poppins' },
    { value: 'Nunito', label: 'Nunito' },
    { value: 'Raleway', label: 'Raleway' },
    { value: 'Quicksand', label: 'Quicksand' },
    { value: 'Rubik', label: 'Rubik' },
    { value: 'Work Sans', label: 'Work Sans' },
    { value: 'DM Sans', label: 'DM Sans' },
    { value: 'Mulish', label: 'Mulish' },
    { value: 'Karla', label: 'Karla' },
    { value: 'Cabin', label: 'Cabin' },
    { value: 'IBM Plex Sans', label: 'IBM Plex Sans' },
    { value: 'Figtree', label: 'Figtree' },
    { value: 'Plus Jakarta Sans', label: 'Plus Jakarta Sans' },
    { value: 'Manrope', label: 'Manrope' },
    { value: 'Barlow', label: 'Barlow' },
    { value: 'Lexend', label: 'Lexend' },
  ]
};

// Get the current border radius value in pixels for use in charts
export function getThemeRadius(): number {
  const root = document.documentElement;
  const radiusAttr = root.getAttribute('data-radius') || 'medium';
  const radiusMap: Record<string, number> = {
    small: 4,
    medium: 8,
    large: 12
  };
  return radiusMap[radiusAttr] || 8;
}

// Helper to darken a hex color
export function darkenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max((num >> 16) - amt, 0);
  const G = Math.max((num >> 8 & 0x00FF) - amt, 0);
  const B = Math.max((num & 0x0000FF) - amt, 0);
  return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

// Convert hex color to HSL values (for Tailwind CSS variables)
export function hexToHSL(hex: string): { h: number; s: number; l: number } {
  // Remove # if present
  hex = hex.replace('#', '');

  // Parse hex values
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}

// Convert HSL to CSS variable format (without hsl() wrapper for Tailwind)
function hslToCssValue(hex: string): string {
  const { h, s, l } = hexToHSL(hex);
  return `${h} ${s}% ${l}%`;
}

// Get current theme colors from CSS variables (for use in charts, etc.)
export function getThemeColors(): ThemeColors {
  const root = document.documentElement;
  const style = getComputedStyle(root);

  return {
    primary: style.getPropertyValue('--theme-primary').trim() || '#8b0000',
    accent: style.getPropertyValue('--theme-accent').trim() || '#f91a1a',
    background: style.getPropertyValue('--theme-background').trim() || '#f9f9f9',
    cardBackground: style.getPropertyValue('--theme-card').trim() || '#ffffff',
    text: style.getPropertyValue('--theme-text').trim() || '#1a1a1a',
    mutedText: style.getPropertyValue('--theme-muted').trim() || '#737373',
    border: style.getPropertyValue('--theme-border').trim() || '#e5e5e5',
    success: style.getPropertyValue('--theme-success').trim() || '#10b981',
    warning: style.getPropertyValue('--theme-warning').trim() || '#f59e0b',
    error: style.getPropertyValue('--theme-error').trim() || '#ef4444',
  };
}

// Apply theme to document
export function applyTheme(theme: ThemeSettings): void {
  const root = document.documentElement;

  // Apply colors
  if (theme.colors) {
    // Custom theme variables (hex format)
    root.style.setProperty('--theme-primary', theme.colors.primary);
    root.style.setProperty('--theme-accent', theme.colors.accent);
    root.style.setProperty('--theme-background', theme.colors.background);
    root.style.setProperty('--theme-card', theme.colors.cardBackground);
    root.style.setProperty('--theme-text', theme.colors.text);
    root.style.setProperty('--theme-muted', theme.colors.mutedText);
    root.style.setProperty('--theme-border', theme.colors.border);
    root.style.setProperty('--theme-success', theme.colors.success);
    root.style.setProperty('--theme-warning', theme.colors.warning);
    root.style.setProperty('--theme-error', theme.colors.error);

    // Derived colors
    root.style.setProperty('--theme-primary-dark', darkenColor(theme.colors.primary, 30));

    // Update Tailwind CSS variables (HSL format for compatibility)
    root.style.setProperty('--primary', hslToCssValue(theme.colors.primary));
    root.style.setProperty('--primary-foreground', '0 0% 100%'); // White text on primary

    root.style.setProperty('--accent', hslToCssValue(theme.colors.accent));
    root.style.setProperty('--accent-foreground', '0 0% 100%'); // White text on accent

    root.style.setProperty('--destructive', hslToCssValue(theme.colors.error));
    root.style.setProperty('--destructive-foreground', '0 0% 100%');

    root.style.setProperty('--background', hslToCssValue(theme.colors.background));
    root.style.setProperty('--foreground', hslToCssValue(theme.colors.text));

    root.style.setProperty('--card', hslToCssValue(theme.colors.cardBackground));
    root.style.setProperty('--card-foreground', hslToCssValue(theme.colors.text));

    root.style.setProperty('--popover', hslToCssValue(theme.colors.cardBackground));
    root.style.setProperty('--popover-foreground', hslToCssValue(theme.colors.text));

    root.style.setProperty('--muted', hslToCssValue(theme.colors.border));
    root.style.setProperty('--muted-foreground', hslToCssValue(theme.colors.mutedText));

    root.style.setProperty('--border', hslToCssValue(theme.colors.border));
    root.style.setProperty('--input', hslToCssValue(theme.colors.border));
    root.style.setProperty('--ring', hslToCssValue(theme.colors.primary));
  }

  // Apply border radius
  if (theme.borderRadius) {
    root.setAttribute('data-radius', theme.borderRadius);

    // Also update the Tailwind --radius variable
    const radiusMap = {
      small: '0.25rem',
      medium: '0.5rem',
      large: '0.75rem'
    };
    root.style.setProperty('--radius', radiusMap[theme.borderRadius]);
  }

  // Apply fonts
  if (theme.fonts) {
    root.style.setProperty('--theme-font-heading', `'${theme.fonts.heading}', system-ui, sans-serif`);
    root.style.setProperty('--theme-font-body', `'${theme.fonts.body}', system-ui, sans-serif`);
  }

  // Apply branding
  if (theme.branding) {
    if (theme.branding.logoUrl) {
      root.style.setProperty('--theme-logo-url', `url('${theme.branding.logoUrl}')`);
    }
    if (theme.branding.backgroundImage) {
      root.style.setProperty('--theme-bg-image', `url('${theme.branding.backgroundImage}')`);
    }
    if (theme.branding.backgroundColor) {
      root.style.setProperty('--theme-bg-color', theme.branding.backgroundColor);
    }
  }
}

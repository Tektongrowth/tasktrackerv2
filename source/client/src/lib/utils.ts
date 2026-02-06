import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDateTime(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }) + ' at ' + d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function isOverdue(dueDate: string | Date): boolean {
  return new Date(dueDate) < new Date();
}

export function getTagColor(tag: string): string {
  const colors: Record<string, string> = {
    web: 'bg-red-100 text-red-800',
    admin: 'bg-yellow-100 text-yellow-800',
    gbp: 'bg-green-100 text-green-800',
    ads: 'bg-blue-100 text-blue-800',
  };
  return colors[tag] || 'bg-gray-100 text-gray-800';
}

/**
 * Sanitize user-generated text content to prevent XSS
 * Escapes HTML entities while preserving whitespace formatting
 */
export function sanitizeText(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Check if a URL is a GIF image URL
 */
function isGifUrl(url: string): boolean {
  const gifPatterns = [
    /giphy\.com\/media\//i,
    /media\d*\.giphy\.com\//i,
    /tenor\.com\/.*\.gif/i,
    /\.gif(\?|$)/i,
  ];
  return gifPatterns.some(pattern => pattern.test(url));
}

/**
 * Sanitize text and convert URLs to clickable links
 * GIF URLs are embedded as images
 * Returns HTML string safe to use with dangerouslySetInnerHTML
 */
export function linkifyText(text: string): string {
  if (!text) return '';

  // First sanitize the text to prevent XSS
  const sanitized = sanitizeText(text);

  // URL regex pattern - matches http, https URLs
  const urlPattern = /(https?:\/\/[^\s<]+[^\s<.,;:!?"')\]])/g;

  // Replace URLs with anchor tags or embedded images
  return sanitized.replace(urlPattern, (url) => {
    // Decode any HTML entities back for the href (they were escaped by sanitizeText)
    const hrefUrl = url
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'");

    // Check if it's a GIF URL - embed as image
    if (isGifUrl(hrefUrl)) {
      return `<img src="${hrefUrl}" alt="GIF" class="max-w-full rounded-lg mt-1" style="max-height: 200px;" />`;
    }

    return `<a href="${hrefUrl}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 hover:underline">${url}</a>`;
  });
}

/**
 * Validate URL to only allow safe protocols (http, https)
 * Returns null for invalid/unsafe URLs
 */
export function sanitizeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    // Only allow http and https protocols
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return url;
    }
    return null;
  } catch {
    return null;
  }
}

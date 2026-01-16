import { AppError } from '../middleware/errorHandler.js';

// Input length limits
export const INPUT_LIMITS = {
  title: 500,
  name: 255,
  description: 10000,
  email: 255,
  phone: 50,
  comment: 5000,
  tag: 100,
  url: 2000,
} as const;

/**
 * Truncate a string to a maximum length
 */
export function truncate(str: string | undefined | null, maxLength: number): string | null {
  if (!str) return null;
  return str.slice(0, maxLength);
}

/**
 * Validate and sanitize a string input
 * Throws AppError if exceeds limit, returns trimmed string or null
 */
export function validateString(
  value: unknown,
  field: string,
  maxLength: number,
  required: boolean = false
): string | null {
  if (value === undefined || value === null || value === '') {
    if (required) {
      throw new AppError(`${field} is required`, 400);
    }
    return null;
  }

  if (typeof value !== 'string') {
    throw new AppError(`${field} must be a string`, 400);
  }

  const trimmed = value.trim();

  if (required && trimmed.length === 0) {
    throw new AppError(`${field} is required`, 400);
  }

  if (trimmed.length > maxLength) {
    throw new AppError(`${field} must be ${maxLength} characters or less`, 400);
  }

  return trimmed || null;
}

/**
 * Validate title field (required, max 500 chars)
 */
export function validateTitle(value: unknown): string {
  const result = validateString(value, 'Title', INPUT_LIMITS.title, true);
  return result!; // Required field, will throw if null
}

/**
 * Validate name field (required, max 255 chars)
 */
export function validateName(value: unknown, required: boolean = true): string | null {
  return validateString(value, 'Name', INPUT_LIMITS.name, required);
}

/**
 * Validate description field (optional, max 10000 chars)
 */
export function validateDescription(value: unknown): string | null {
  return validateString(value, 'Description', INPUT_LIMITS.description, false);
}

/**
 * Validate email field (max 255 chars)
 */
export function validateEmail(value: unknown, required: boolean = false): string | null {
  const result = validateString(value, 'Email', INPUT_LIMITS.email, required);
  if (result && !result.includes('@')) {
    throw new AppError('Invalid email format', 400);
  }
  return result;
}

/**
 * Validate phone field (max 50 chars)
 */
export function validatePhone(value: unknown): string | null {
  return validateString(value, 'Phone', INPUT_LIMITS.phone, false);
}

/**
 * Validate comment field (required, max 5000 chars)
 */
export function validateComment(value: unknown): string {
  const result = validateString(value, 'Comment', INPUT_LIMITS.comment, true);
  return result!;
}

import { Request } from 'express';

/**
 * Safely extract a string parameter from Express route params.
 * Express types params as string | string[], but in practice single params are strings.
 */
export function getParam(req: Request, name: string): string {
  const value = req.params[name];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

/**
 * Safely extract a string from Express query params.
 * Query params can be string | ParsedQs | (string | ParsedQs)[]
 */
export function getQueryString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0];
  }
  return undefined;
}

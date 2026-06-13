// lib/validation.ts
// Shared validation utilities

/**
 * Validate an ISO 6346 container number.
 * Format: 4 letters (owner code + category letter U/J/Z) + 7 digits
 * Examples: MSDU9955006, HAMU3720267, TCLU4260880
 *
 * Returns true if the format is valid.
 */
export function isValidContainerNumber(value: string): boolean {
  if (!value) return false
  // 4 alpha + 7 numeric, case-insensitive
  return /^[A-Z]{4}\d{7}$/i.test(value.trim())
}

import { z } from "zod"
import { NextResponse } from "next/server"

/**
 * Validate an unknown request body against a Zod schema.
 *
 * Returns `{ success: true, data }` with the parsed & typed result,
 * or `{ success: false, response }` with a 400 NextResponse containing
 * field-level error details.
 */
export function validateBody<T>(
  body: unknown,
  schema: z.ZodType<T>,
): { success: true; data: T } | { success: false; response: NextResponse } {
  const result = schema.safeParse(body)

  if (result.success) {
    return { success: true, data: result.data }
  }

  // Build a human-readable list of field errors
  const fieldErrors = result.error.issues.map((issue) => ({
    field: issue.path.join(".") || "(root)",
    message: issue.message,
  }))

  return {
    success: false,
    response: NextResponse.json(
      {
        error: "Validation failed",
        details: fieldErrors,
      },
      { status: 400 },
    ),
  }
}

/**
 * Extracts the best available error message from an API error response.
 * Prefers per-field Zod validation details (e.g. "password: Must contain an
 * uppercase letter") over the generic "Validation failed" message, since the
 * generic one alone tells the user nothing about what to fix.
 */
export function extractErrorMessage(err: any, fallback: string): string {
  const fieldErrors = err?.response?.data?.errors as { path: string; message: string }[] | undefined;
  if (fieldErrors?.length) {
    return fieldErrors.map((e) => (e.path ? `${e.path}: ${e.message}` : e.message)).join(" · ");
  }
  return err?.response?.data?.message ?? fallback;
}

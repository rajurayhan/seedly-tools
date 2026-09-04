/**
 * CASL subjects for the HighLevel import add-on.
 *
 * Host derivation of `ghl_import` is `Ghl_import` (first letter only). These
 * names must match that derivation or AccessGuard hides every import route.
 */
export const extensionSubjects = ['Ghl_import'] as const;

export type GhlImportSubject = (typeof extensionSubjects)[number];

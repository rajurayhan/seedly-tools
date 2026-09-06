/**
 * CASL subjects for SeedlyPin.
 * Host derivation of `seedly_pin` is `Seedly_pin` (first letter only).
 */
export const extensionSubjects = ['Seedly_pin'] as const;

export type SeedlyPinSubject = (typeof extensionSubjects)[number];

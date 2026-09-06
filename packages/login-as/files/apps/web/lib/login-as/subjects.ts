/**
 * CASL subjects for Login as location user.
 * Host derivation of `login_as` is `Login_as` (first letter only).
 */
export const extensionSubjects = ['Login_as'] as const;

export type LoginAsSubject = (typeof extensionSubjects)[number];

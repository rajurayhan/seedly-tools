/**
 * CASL subjects for SeedlyMCP.
 * Host derivation of `seedly_mcp` is `Seedly_mcp` (first letter only).
 */
export const extensionSubjects = ['Seedly_mcp'] as const;

export type SeedlyMcpSubject = (typeof extensionSubjects)[number];

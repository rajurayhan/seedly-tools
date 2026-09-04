/** Host guard exemptions for the HighLevel import add-on. Types declared locally. */

export type ExtensionGuardExemption = {
  readonly target: string;
  readonly reason: string;
};

export const extensionGuardAllowlist: Record<string, readonly ExtensionGuardExemption[]> = {
  'two-factor-action-enforcement': [
    {
      target: 'ghl.ts::validateToken',
      reason:
        'Read-only check that a pasted Private Integration Token is accepted by GoHighLevel. Does not persist the token or plant credentials.',
    },
    {
      target: 'ghl.ts::preflight',
      reason:
        'Read-only scan of an already-connected GHL location to populate entity counts. No write, no new token planting.',
    },
  ],
};

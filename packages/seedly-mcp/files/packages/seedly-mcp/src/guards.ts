export type ExtensionGuardExemption = {
  readonly target: string;
  readonly reason: string;
};

export const extensionGuardAllowlist: Record<string, readonly ExtensionGuardExemption[]> = {
  'two-factor-action-enforcement': [],
};

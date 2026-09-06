/** Matches the host's `PermissionModuleDef`. Declared locally. */
export type PermissionModuleDef = {
  key: string;
  label: string;
  parent?: string;
  description: string;
  tab: 'crm' | 'sales' | 'marketing' | 'finance' | 'administration';
};

export const extensionPermissionModules: PermissionModuleDef[] = [
  {
    key: 'seedly_pin',
    label: 'SeedlyPin',
    description: 'Drop and triage in-CRM pins',
    tab: 'administration',
  },
];

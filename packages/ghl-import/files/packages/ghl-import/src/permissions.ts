/** Matches the host's `PermissionModuleDef`. Declared locally so this package does not import `@seedly-crm/shared`. */
export type PermissionModuleDef = {
  key: string;
  label: string;
  parent?: string;
  description: string;
  tab: 'crm' | 'sales' | 'marketing' | 'finance' | 'administration';
};

export const extensionPermissionModules: PermissionModuleDef[] = [
  {
    key: 'ghl_import',
    label: 'HighLevel import',
    description: 'Connect a GoHighLevel token and import a location into this Seedly location',
    tab: 'administration',
  },
];

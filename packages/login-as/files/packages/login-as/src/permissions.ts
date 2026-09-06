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
    key: 'login_as',
    label: 'Login as location user',
    description: 'Agency owner opens a location as that location’s user',
    tab: 'administration',
  },
];

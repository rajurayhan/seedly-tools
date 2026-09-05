export type PermissionModuleDef = {
  key: string;
  label: string;
  parent?: string;
  description: string;
  tab: 'crm' | 'sales' | 'marketing' | 'finance' | 'administration';
};

export const extensionPermissionModules: PermissionModuleDef[] = [
  {
    key: 'seedly_mcp',
    label: 'SeedlyMCP',
    description: 'Connect Cursor or Claude to this Seedly with /api/v1 tools',
    tab: 'administration',
  },
];

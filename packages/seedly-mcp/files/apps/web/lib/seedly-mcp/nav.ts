import { Plug } from 'lucide-react';
import type { ElementType } from 'react';
import type { SeedlyMcpSubject } from './subjects';

type NavItem = {
  label: string;
  href: string;
  icon: ElementType;
};

export const extensionNavItems: NavItem[] = [
  { label: 'MCP', href: '/mcp-setup', icon: Plug },
];

export const extensionNavFeatureMap: Record<string, string> = {
  '/mcp-setup': 'seedly_mcp',
};

export const extensionSidebarSubjectMap: Record<string, SeedlyMcpSubject> = {
  '/mcp-setup': 'Seedly_mcp',
};

export const extensionSettingsTabs: { label: string; href: string; subject: SeedlyMcpSubject }[] =
  [];

export const extensionRoutePermissions: { path: string; subject: SeedlyMcpSubject }[] = [
  { path: '/mcp-setup', subject: 'Seedly_mcp' },
];

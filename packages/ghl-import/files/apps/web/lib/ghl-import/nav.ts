import { Import } from 'lucide-react';
import type { ElementType } from 'react';
import type { GhlImportSubject } from './subjects';

type NavItem = {
  label: string;
  href: string;
  icon: ElementType;
};

export const extensionNavItems: NavItem[] = [
  { label: 'Import', href: '/import', icon: Import },
];

export const extensionNavFeatureMap: Record<string, string> = {
  '/import': 'ghl_import',
};

export const extensionSidebarSubjectMap: Record<string, GhlImportSubject> = {
  '/import': 'Ghl_import',
};

export const extensionSettingsTabs: { label: string; href: string; subject: GhlImportSubject }[] =
  [];

export const extensionRoutePermissions: { path: string; subject: GhlImportSubject }[] = [
  { path: '/import', subject: 'Ghl_import' },
];

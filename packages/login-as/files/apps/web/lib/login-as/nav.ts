import type { ElementType } from 'react';
import type { LoginAsSubject } from './subjects';

type NavItem = {
  label: string;
  href: string;
  icon: ElementType;
};

export const extensionNavItems: NavItem[] = [];

export const extensionNavFeatureMap: Record<string, string> = {};

export const extensionSidebarSubjectMap: Record<string, LoginAsSubject> = {};

export const extensionSettingsTabs: { label: string; href: string; subject: LoginAsSubject }[] = [];

export const extensionRoutePermissions: { path: string; subject: LoginAsSubject }[] = [];

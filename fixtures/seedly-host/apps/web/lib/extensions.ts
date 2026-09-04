import type { ElementType } from 'react';
import type { Subjects } from './permissions';

import * as _m0 from './dispatch/nav';

export type ExtensionNavItem = {
  label: string;
  href: string;
  icon: ElementType;
};

export const extensionNavItems: ExtensionNavItem[] = [
  ..._m0.extensionNavItems,
];
export const extensionNavFeatureMap: Record<string, string> = {
  ..._m0.extensionNavFeatureMap,
};
export const extensionSidebarSubjectMap: Record<string, Subjects> = {
  ..._m0.extensionSidebarSubjectMap,
};
export const extensionRoutePermissions: { path: string; subject: Subjects }[] = [
  ..._m0.extensionRoutePermissions,
];

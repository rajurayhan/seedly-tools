import { MapPin } from 'lucide-react';
import type { ElementType } from 'react';
import type { SeedlyPinSubject } from './subjects';

type NavItem = {
  label: string;
  href: string;
  icon: ElementType;
};

export const extensionNavItems: NavItem[] = [{ label: 'Pins', href: '/pins', icon: MapPin }];

/** Agency-wide master switch — not a plan feature. */
export const extensionNavFeatureMap: Record<string, string> = {};

export const extensionSidebarSubjectMap: Record<string, SeedlyPinSubject> = {
  '/pins': 'Seedly_pin',
};

export const extensionSettingsTabs: { label: string; href: string; subject: SeedlyPinSubject }[] = [];

export const extensionRoutePermissions: { path: string; subject: SeedlyPinSubject }[] = [
  { path: '/pins', subject: 'Seedly_pin' },
  { path: '/settings/pins', subject: 'Seedly_pin' },
];

'use client';

// Agency-scoped settings only. Per-sub-account settings live under
// `/location/{publicId}/settings/...` and use a separate layout.
const settingsTabs = [
  { label: 'Access', href: '/settings/access' },
  { label: 'Audit Log', href: '/settings/audit-log' },
];

export default function SettingsPageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      {settingsTabs.map((tab) => (
        <a key={tab.href} href={tab.href}>
          {tab.label}
        </a>
      ))}
      {children}
    </div>
  );
}

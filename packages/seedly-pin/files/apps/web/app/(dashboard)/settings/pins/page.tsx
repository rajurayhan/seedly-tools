'use client';

import { SeedlyPinSettingsPanel } from '@/lib/seedly-pin/settings-panel';

export default function SeedlyPinSettingsPage() {
  return (
    <div className="animate-slide-in-up space-y-6 pb-8">
      <SeedlyPinSettingsPanel />
    </div>
  );
}

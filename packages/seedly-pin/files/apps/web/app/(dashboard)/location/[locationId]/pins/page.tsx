'use client';

import { SeedlyPinInbox } from '@/lib/seedly-pin/inbox';

export default function SeedlyPinInboxPage() {
  return (
    <div className="h-full overflow-y-auto p-6">
      <SeedlyPinInbox />
    </div>
  );
}

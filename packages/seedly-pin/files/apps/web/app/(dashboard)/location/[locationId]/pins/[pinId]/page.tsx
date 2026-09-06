'use client';

import { useParams } from 'next/navigation';
import { SeedlyPinDetail } from '@/lib/seedly-pin/inbox';

export default function SeedlyPinDetailPage() {
  const params = useParams();
  return (
    <div className="h-full overflow-y-auto p-6">
      <SeedlyPinDetail pinId={String(params?.pinId ?? '')} />
    </div>
  );
}

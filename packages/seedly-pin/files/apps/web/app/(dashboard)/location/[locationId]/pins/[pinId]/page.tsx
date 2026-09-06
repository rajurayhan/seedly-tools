'use client';

import { useParams } from 'next/navigation';
import { SeedlyPinDetail } from '@/lib/seedly-pin/inbox';

export default function SeedlyPinDetailPage() {
  const params = useParams();
  return <SeedlyPinDetail pinId={String(params?.pinId ?? '')} />;
}

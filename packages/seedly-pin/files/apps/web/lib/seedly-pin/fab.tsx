'use client';

import { useState } from 'react';
import { useQuery } from 'convex/react';
import { makeFunctionReference } from 'convex/server';
import { MapPin } from 'lucide-react';
import { SeedlyPinOverlay } from './overlay';

const availabilityRef = makeFunctionReference<'query'>('seedlyPin/api:getAvailability');

export function SeedlyPinFab() {
  const availability = useQuery(availabilityRef);
  const [open, setOpen] = useState(false);

  if (!availability?.canDrop) return null;

  return (
    <>
      <button
        type="button"
        data-seedly-pin="fab"
        aria-label="Drop pin"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-[70] flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl hover:opacity-90"
      >
        <MapPin className="h-6 w-6" />
      </button>
      <SeedlyPinOverlay open={open} onClose={() => setOpen(false)} />
    </>
  );
}

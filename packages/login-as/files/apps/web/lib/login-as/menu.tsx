'use client';

import { useState } from 'react';
import { useQuery } from 'convex/react';

import { api } from '../../../../convex/_generated/api';
import { LoginAsPicker } from './picker';

export function LoginAsMenuItem() {
  const availability = useQuery(api.loginAs.api.getAvailability);
  const [open, setOpen] = useState(false);

  if (availability === undefined || !availability.visible) return null;

  return (
    <>
      <button
        type="button"
        className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
        onClick={() => setOpen(true)}
      >
        Login as location user
      </button>
      <LoginAsPicker
        open={open}
        onOpenChange={setOpen}
        twoFactorEnrolled={availability.twoFactorEnrolled}
      />
    </>
  );
}

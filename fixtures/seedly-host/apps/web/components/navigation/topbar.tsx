'use client';

import Link from 'next/link';
import { runExtensionSignOutHooks } from '@/lib/extension-signout-hooks';

function UserMenu() {
  const handleSignOut = async () => {
    await runExtensionSignOutHooks();
  };

  return (
    <div>
        <Link href="/account/settings">
            Account
        </Link>
    </div>
  );
}

export function Topbar() {
  return (
    <header>
      <UserMenu />
    </header>
  );
}

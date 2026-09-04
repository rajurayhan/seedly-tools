/** Paths no add-on may copy or claim. */
export const FORBIDDEN = ['SETUP/', 'LICENSE.md', 'SUPPORT.md', 'convex/http.ts'];

/**
 * Shared host leaves. Append-only. An add-on must not list these in ownedFiles.
 * convex/http.ts is also forbidden to copy.
 */
export const SHARED_SEAMS = [
  'convex/extensions/index.ts',
  'convex/extensions/snapshot.ts',
  'convex/extensions/crons.ts',
  'convex/extensions/apiRoutes.ts',
  'apps/web/lib/extensions.ts',
  'apps/web/lib/extension-plan-features.ts',
  'convex/http.ts',
];

/** Host leaves that must stay import-free. Installer may insert literals only. */
export const ZERO_IMPORT_FILES = [
  'apps/web/lib/extension-plan-features.ts',
  'apps/web/lib/extension-public-paths.ts',
  'apps/web/lib/extension-headers.ts',
  'apps/web/lib/extension-workflow-palette.ts',
  'apps/web/lib/extension-form-palette.ts',
  'apps/web/lib/extension-integration-cards.ts',
];

export const MODULES_FILENAME = '.modules.json';
export const MODULES_FORMAT = 1;

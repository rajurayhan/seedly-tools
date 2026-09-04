import type { PermissionModuleDef } from './constants/permissions';

import * as _m0 from '../../dispatch/registry/permissions';

export const extensionPermissionModules: PermissionModuleDef[] = [
  ..._m0.extensionPermissionModules,
];

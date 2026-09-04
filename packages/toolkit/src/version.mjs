function parseVer(value) {
  const match = String(value ?? '').match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function cmp(a, b) {
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

/**
 * Satisfies a space-separated range like ">=5.8.0 <5.9.0".
 */
export function satisfiesRange(version, range) {
  const ver = parseVer(version);
  if (!ver || !range) return false;
  const parts = String(range).trim().split(/\s+/);
  for (const part of parts) {
    const match = part.match(/^(>=|>|<=|<|=)(.+)$/);
    if (!match) return false;
    const bound = parseVer(match[2]);
    if (!bound) return false;
    const c = cmp(ver, bound);
    if (match[1] === '>=' && c < 0) return false;
    if (match[1] === '>' && c <= 0) return false;
    if (match[1] === '<=' && c > 0) return false;
    if (match[1] === '<' && c >= 0) return false;
    if (match[1] === '=' && c !== 0) return false;
  }
  return true;
}

export function assertHostCompatible(hostPkg, moduleJson) {
  const version = String(hostPkg.version ?? '');
  const range = moduleJson.seedlyRange;
  if (range && !satisfiesRange(version, range)) {
    throw new Error(`This add-on targets Seedly ${range} (found ${version || 'unknown'})`);
  }
  const hostApi = hostPkg.extensionApiVersion;
  const moduleApi = moduleJson.extensionApiVersion;
  if (hostApi !== undefined && hostApi !== moduleApi) {
    throw new Error(
      `This add-on targets extensionApiVersion ${moduleApi} (found ${hostApi})`,
    );
  }
}

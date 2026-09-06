type StopFn = () => void | Promise<void>;

let registeredStop: StopFn | null = null;

export function registerLoginAsStop(fn: StopFn | null) {
  registeredStop = fn;
}

export async function stopLoginAsOnSignOut() {
  if (!registeredStop) return;
  try {
    await registeredStop();
  } catch {
    // Sign-out must complete even if stop fails.
  }
}

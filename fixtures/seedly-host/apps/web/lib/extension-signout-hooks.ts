export type ExtensionSignOutHook = {
  id: string;
  run: () => void | Promise<void>;
};

export const extensionSignOutHooks: ExtensionSignOutHook[] = [];

export async function runExtensionSignOutHooks(
  hooks: readonly ExtensionSignOutHook[] = extensionSignOutHooks,
): Promise<void> {
  for (const hook of hooks) {
    await hook.run();
  }
}

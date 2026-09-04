export type ExtensionPlanFeature = {
  readonly key: string;
  readonly label: string;
  readonly group?: string;
};

export const extensionPlanFeatures: readonly ExtensionPlanFeature[] = [
  {
    key: 'dispatch',
    label: 'Dispatch',
    group: 'Add-ons',
  },
];

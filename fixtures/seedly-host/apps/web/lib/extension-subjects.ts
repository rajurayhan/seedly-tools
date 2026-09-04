import * as _m0 from './dispatch/subjects';

export const extensionSubjects = [..._m0.extensionSubjects] as const;

export type ExtensionSubject = (typeof extensionSubjects)[number];

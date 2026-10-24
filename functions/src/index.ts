/**
 * FORMA Cloud Functions — the only trusted backend.
 *  - User callables: config, AI (chat, workout drafts, feedback), data export, account deletion.
 *  - adminApi: the owner console's single, role-checked, audited endpoint.
 */
export { getMyConfig, aiChat, aiFeedback, aiGenerateWorkout, exportMyData, deleteMyAccount } from './api/user';
export { adminApi } from './api/admin';

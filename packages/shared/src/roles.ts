/**
 * Admin roles are stored ONLY as Firebase Auth custom claims (`role`), which can
 * be set solely by trusted server code. A Firestore field is never trusted.
 */

export const ADMIN_ROLES = ['owner', 'admin', 'support', 'analyst'] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const PERMISSIONS = [
  'overview.read',
  'providers.read',
  'providers.write',
  'providers.secrets',
  'routing.read',
  'routing.write',
  'flags.read',
  'flags.write',
  'users.read',
  'users.write',
  'users.delete',
  'entitlements.write',
  'plans.write',
  'usage.read',
  'budgets.write',
  'prompts.read',
  'prompts.write',
  'prompts.publish',
  'settings.read',
  'settings.write',
  'audit.read',
  'admins.manage',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const READ_ALL: Permission[] = [
  'overview.read',
  'providers.read',
  'routing.read',
  'flags.read',
  'usage.read',
  'prompts.read',
  'settings.read',
];

export const ROLE_PERMISSIONS: Record<AdminRole, readonly Permission[]> = {
  owner: PERMISSIONS,
  admin: PERMISSIONS.filter((p) => p !== 'admins.manage' && p !== 'users.delete'),
  support: ['overview.read', 'users.read', 'users.write', 'entitlements.write', 'flags.read', 'audit.read'],
  analyst: [...READ_ALL, 'audit.read'],
};

export function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === 'string' && (ADMIN_ROLES as readonly string[]).includes(value);
}

export function hasPermission(role: unknown, permission: Permission): boolean {
  return isAdminRole(role) && ROLE_PERMISSIONS[role].includes(permission);
}

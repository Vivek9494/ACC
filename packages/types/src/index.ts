/**
 * @acc/types — shared TypeScript types for the ACC monorepo.
 *
 * This package is the single source of truth for enums, constants, and DTO/
 * schema types shared between the api (`@acc/api`) and mobile (`@acc/mobile`)
 * apps. There must be no duplication of these definitions across the apps.
 *
 * Real types are added per feature slice and re-exported here.
 */
export const ACC_TYPES_PACKAGE = '@acc/types';

export * from './postal-code';
export * from './jersey-size';
export * from './signup-validation';
export * from './profile';
export * from './admin';
export * from './auth';
export * from './password-policy';
export * from './club-manager';
export * from './captain';
export * from './center-sevak';
export * from './player';
export * from './guest';
export * from './center';
export * from './province';
export * from './live';
export * from './match';
export * from './rbac';
export * from './registration';
export * from './scorecard';
export * from './scoring';
export * from './tournament';

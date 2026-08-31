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

export * from './app-branding';
export * from './push-notification';
export * from './postal-code';
export * from './jersey-size';
export * from './signup-validation';
export * from './profile';
export * from './admin';
export * from './app-settings';
export * from './birthdays';
export * from './broadcast';
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
export * from './overlay-theme';
export * from './broadcast-stats';
export * from './group';
export * from './tournament-groups';
export * from './knockout-team-count';
export * from './knockout-bracket';
export * from './knockout-bracket-plan';
export * from './knockout-manual-layout';
export * from './knockout-qualification';
export * from './knockout-seeding';
export * from './match';
export * from './playing-xi-finalize';
export * from './match-detail-status';
export * from './match-live-start';
export * from './match-delay';
export * from './match-scheduling-access';
export * from './match-list';
export * from './my-matches';
export * from './poll';
export * from './attendance';
export * from './punch-time-scope';
export * from './late-arrival-penalty';
export * from './suspension';
export * from './captain-dashboard-actions';
export * from './timezone';
export * from './match-setup';
export * from './match-scheduling-format';
export * from './rbac';
export * from './registration';
export * from './fee';
export * from './fee-access';
export * from './registration-access';
export * from './video';
export * from './storage';
export * from './scorecard';
export * from './scoring';
export * from './wagon-wheel';
export * from './live-innings-stats';
export * from './leather-tournament-access';
export * from './tournament-create-defaults';
export * from './tournament';
export * from './tournament-browse';
export * from './tournament-fees';
export * from './tournament-scope';
export * from './tournament-scorers';
export * from './tournament-media';
export * from './tournament-validation';
export * from './tournament-form-validation';
export * from './tournament-field-limits';
export * from './tournament-dates';
export * from './tournament-dashboard';
export * from './tournament-display-status';
export * from './tournament-registration';
export * from './tournament-type-definition';
export * from './player-mom-stats';
export * from './player-profile';
export * from './team';
export * from './team-access';
export * from './standings';
export * from './leaderboard';
export * from './tournament-stats';
export * from './places';
export * from './location-input';

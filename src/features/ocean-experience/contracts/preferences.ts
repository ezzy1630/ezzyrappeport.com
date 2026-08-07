/**
 * Preference contract surface for ocean-experience runtime modules.
 * Re-exports the store types so render/scene code depends on contracts/.
 */

export type {
  ExperiencePreferences,
  MotionPreference,
  QualityPreference,
} from "../state/preferences-store.ts";

export {
  DEFAULT_PREFERENCES,
  applyOsReducedMotionCeiling,
  isMotionPreference,
  isQualityPreference,
  resolveInitialPreferences,
  sanitizePreferences,
  shouldUseSimpleStory,
} from "../state/preferences-store.ts";

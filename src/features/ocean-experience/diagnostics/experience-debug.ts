/**
 * Development/test window.__oceanExperience API.
 * Types are explicit; production builds expose nothing unless explicitly installed.
 */

import type { ChapterId } from "../contracts/chapter.ts";
import { isChapterId } from "../contracts/chapter.ts";
import type { ScrollDirector } from "../scroll/ScrollDirector.ts";
import {
  getExperienceSnapshot,
  type ExperienceSnapshot,
} from "../state/experience-store.ts";
import {
  getPreferencesSnapshot,
  isQualityPreference,
  setPreferences,
  type QualityPreference,
} from "../state/preferences-store.ts";
import {
  frameClockFaults,
  frameClockSubscriberCount,
} from "../../../lib/portfolio/frame-clock.ts";
import type { ResourceRegistry } from "../runtime/resource-registry.ts";

export type ExperienceDebugState = {
  experience: ExperienceSnapshot;
  preferences: ReturnType<typeof getPreferencesSnapshot>;
  frame: {
    subscriberCount: number;
    faults: ReturnType<typeof frameClockFaults>;
  };
  resources: {
    ids: string[];
    loadGeneration: number;
    fallbackReason: string | null;
    contextLost: boolean;
  } | null;
};

export type ExperienceDebugApi = {
  seek(progress: number): void;
  seekChapter(id: ChapterId): void;
  getState(): ExperienceDebugState;
  setQuality(tier: QualityPreference): void;
};

declare global {
  interface Window {
    __oceanExperience?: ExperienceDebugApi;
  }
}

export function createExperienceDebugApi(
  director: ScrollDirector,
  registry?: ResourceRegistry | null,
): ExperienceDebugApi {
  return {
    seek(progress: number): void {
      director.seek(progress);
    },
    seekChapter(id: string): void {
      if (!isChapterId(id)) {
        throw new Error(`Unknown chapter id: ${id}`);
      }
      director.seekChapter(id);
    },
    getState(): ExperienceDebugState {
      return {
        experience: getExperienceSnapshot(),
        preferences: getPreferencesSnapshot(),
        frame: {
          subscriberCount: frameClockSubscriberCount(),
          faults: frameClockFaults(),
        },
        resources: registry
          ? {
              ids: registry.listIds(),
              loadGeneration: registry.currentLoadGeneration(),
              fallbackReason: registry.getFallbackReason(),
              contextLost: registry.isContextLost(),
            }
          : null,
      };
    },
    setQuality(tier: QualityPreference): void {
      if (!isQualityPreference(tier)) {
        throw new Error(`Unknown quality tier: ${String(tier)}`);
      }
      setPreferences({ quality: tier });
    },
  };
}

/**
 * Installs window.__oceanExperience in development or when explicitly forced.
 * Returns a disposer that removes the API when it still points at this instance.
 */
export function installExperienceDebugApi(
  director: ScrollDirector,
  options?: { force?: boolean; registry?: ResourceRegistry | null },
): () => void {
  if (typeof window === "undefined") return () => undefined;

  const allow =
    options?.force === true ||
    process.env.NODE_ENV === "development" ||
    process.env.NEXT_PUBLIC_EXPERIENCE_DEBUG === "1";

  if (!allow) return () => undefined;

  const api = createExperienceDebugApi(director, options?.registry ?? null);
  window.__oceanExperience = api;

  return () => {
    if (window.__oceanExperience === api) {
      delete window.__oceanExperience;
    }
  };
}

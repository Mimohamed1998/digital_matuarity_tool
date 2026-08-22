'use client';

import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Answers, AnswerValue, RespondentInfo } from '@/types/domain';

/**
 * Survey progress, persisted to sessionStorage.
 *
 * sessionStorage, not localStorage, is the whole point: a refresh keeps your place
 * (NFR-5) but closing the tab loses it, which is what "users might not be able to
 * retrieve a previously done survey" means in practice (FR-10).
 *
 * Only the step INDEX is stored, never a resolved factor. The factor for a step is
 * derived from config at render time, so editing conf.yaml cannot corrupt a store that
 * is already sitting in someone's browser.
 */

export const SURVEY_STORAGE_KEY = 'dm-survey-progress';

export type SubmissionState = 'idle' | 'saving' | 'saved' | 'error';

/** Step 0 is the respondent form, steps 1..N are the N factors, step N+1 is review. */
export const RESPONDENT_STEP = 0;

export interface SurveyState {
  /** The conf.yaml meta.version this progress was captured under. */
  configVersion: string | null;
  respondent: Partial<RespondentInfo>;
  answers: Partial<Answers>;
  currentStep: number;
  startedAt: number | null;
  submissionState: SubmissionState;
  /** Set when a step is reached from the review panel, so Back returns there. */
  returnToReview: boolean;

  setConfigVersion: (version: string) => void;
  setRespondentField: (field: string, value: string | number | undefined) => void;
  setRespondent: (respondent: Partial<RespondentInfo>) => void;
  setAnswer: (factorId: string, answer: AnswerValue) => void;
  next: (maxStep: number) => void;
  prev: () => void;
  goTo: (step: number, options?: { returnToReview?: boolean }) => void;
  markStarted: () => void;
  setSubmissionState: (state: SubmissionState) => void;
  reset: () => void;
}

const INITIAL = {
  configVersion: null,
  respondent: {},
  answers: {},
  currentStep: RESPONDENT_STEP,
  startedAt: null,
  submissionState: 'idle',
  returnToReview: false,
} satisfies Omit<
  SurveyState,
  | 'setConfigVersion'
  | 'setRespondentField'
  | 'setRespondent'
  | 'setAnswer'
  | 'next'
  | 'prev'
  | 'goTo'
  | 'markStarted'
  | 'setSubmissionState'
  | 'reset'
>;

export const useSurveyStore = create<SurveyState>()(
  persist(
    (set) => ({
      ...INITIAL,

      /**
       * Records the config version this progress belongs to, and throws the progress
       * away if it was captured under a different one. Answers carried across a changed
       * questionnaire are worse than starting again.
       */
      setConfigVersion: (version) =>
        set((state) =>
          state.configVersion === null
            ? { configVersion: version }
            : state.configVersion === version
              ? state
              : { ...INITIAL, configVersion: version },
        ),

      setRespondentField: (field, value) =>
        set((state) => ({ respondent: { ...state.respondent, [field]: value } })),

      setRespondent: (respondent) => set({ respondent }),

      setAnswer: (factorId, answer) =>
        set((state) => ({ answers: { ...state.answers, [factorId]: answer } })),

      next: (maxStep) =>
        set((state) => ({ currentStep: Math.min(state.currentStep + 1, maxStep) })),

      prev: () => set((state) => ({ currentStep: Math.max(state.currentStep - 1, 0) })),

      goTo: (step, options) =>
        set({ currentStep: Math.max(step, 0), returnToReview: options?.returnToReview ?? false }),

      markStarted: () => set((state) => (state.startedAt ? state : { startedAt: Date.now() })),

      setSubmissionState: (submissionState) => set({ submissionState }),

      reset: () => {
        set({ ...INITIAL });
        if (typeof window !== 'undefined') {
          window.sessionStorage.removeItem(SURVEY_STORAGE_KEY);
        }
      },
    }),
    {
      name: SURVEY_STORAGE_KEY,
      storage: createJSONStorage(() => sessionStorage),
      // Derived values (scores, levels, recommendations) are deliberately absent: they
      // are computed from `answers` on demand, so they can never drift out of date.
      partialize: (state) => ({
        configVersion: state.configVersion,
        respondent: state.respondent,
        answers: state.answers,
        currentStep: state.currentStep,
        startedAt: state.startedAt,
        returnToReview: state.returnToReview,
      }),
    },
  ),
);

/**
 * True once zustand has rehydrated from sessionStorage.
 *
 * Reading `persist.hasHydrated()` directly would not re-render the component when
 * hydration finishes, which is exactly the moment the results page needs to know about
 * — otherwise it paints the "no answers yet" empty state over data that is about to
 * arrive, and that reads as data loss.
 */
const subscribeToHydration = (onStoreChange: () => void) =>
  useSurveyStore.persist.onFinishHydration(onStoreChange);

export function useSurveyHydrated(): boolean {
  return useSyncExternalStore(
    subscribeToHydration,
    () => useSurveyStore.persist.hasHydrated(),
    // On the server there is no sessionStorage, so nothing is ever hydrated.
    () => false,
  );
}

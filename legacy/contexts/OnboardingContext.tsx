import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { OnboardingState, OnboardingData, OnboardingAction, OnboardingContextType } from '@/types/onboarding';

const ONBOARDING_STORAGE_KEY = 'renegades_onboarding_progress';

const initialState: OnboardingState = {
  currentStep: 1,
  totalSteps: 2,
  completedSteps: [],
  isLoading: false,
  error: null,
  data: {},
  progress: 0,
};

function onboardingReducer(state: OnboardingState, action: OnboardingAction): OnboardingState {
  switch (action.type) {
    case 'SET_STEP':
      return {
        ...state,
        currentStep: action.payload,
        error: null,
      };

    case 'COMPLETE_STEP':
      const newCompletedSteps = [...state.completedSteps];
      if (!newCompletedSteps.includes(action.payload)) {
        newCompletedSteps.push(action.payload);
      }
      return {
        ...state,
        completedSteps: newCompletedSteps,
        progress: Math.round((newCompletedSteps.length / state.totalSteps) * 100),
      };

    case 'UPDATE_DATA':
      return {
        ...state,
        data: { ...state.data, ...action.payload },
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        isLoading: false,
      };

    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };

    case 'RESET':
      return initialState;

    case 'LOAD_PROGRESS':
      return { ...state, ...action.payload };

    default:
      return state;
  }
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

interface OnboardingProviderProps {
  children: React.ReactNode;
  initialStep?: number;
}

export const OnboardingProvider: React.FC<OnboardingProviderProps> = ({
  children,
  initialStep = 1
}) => {
  const [state, dispatch] = useReducer(onboardingReducer, {
    ...initialState,
    currentStep: initialStep
  });

  // Save progress to localStorage
  const saveProgress = useCallback(() => {
    try {
      const progressData = {
        currentStep: state.currentStep,
        completedSteps: state.completedSteps,
        data: state.data,
        progress: state.progress,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(progressData));
    } catch (error) {
      console.warn('Failed to save onboarding progress:', error);
    }
  }, [state.currentStep, state.completedSteps, state.data, state.progress]);

  // Load progress from localStorage
  const loadProgress = useCallback(() => {
    try {
      const savedProgress = localStorage.getItem(ONBOARDING_STORAGE_KEY);
      if (savedProgress) {
        const progressData = JSON.parse(savedProgress);

        // Check if progress is not too old (24 hours)
        const savedAt = new Date(progressData.savedAt);
        const now = new Date();
        const hoursDiff = (now.getTime() - savedAt.getTime()) / (1000 * 60 * 60);

        if (hoursDiff < 24) {
          dispatch({
            type: 'LOAD_PROGRESS',
            payload: {
              currentStep: progressData.currentStep || 1,
              completedSteps: progressData.completedSteps || [],
              data: progressData.data || {},
              progress: progressData.progress || 0,
            }
          });
        }
      }
    } catch (error) {
      console.warn('Failed to load onboarding progress:', error);
    }
  }, []);

  // Auto-save progress when state changes
  useEffect(() => {
    if (state.currentStep > 1 || state.completedSteps.length > 0) {
      saveProgress();
    }
  }, [state.currentStep, state.completedSteps, state.data, saveProgress]);

  // Load progress on mount
  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

  const goToStep = useCallback((step: number) => {
    if (step >= 1 && step <= state.totalSteps) {
      dispatch({ type: 'SET_STEP', payload: step });
    }
  }, [state.totalSteps]);

  const nextStep = useCallback(() => {
    if (state.currentStep < state.totalSteps) {
      dispatch({ type: 'SET_STEP', payload: state.currentStep + 1 });
    }
  }, [state.currentStep, state.totalSteps]);

  const previousStep = useCallback(() => {
    if (state.currentStep > 1) {
      dispatch({ type: 'SET_STEP', payload: state.currentStep - 1 });
    }
  }, [state.currentStep]);

  const completeStep = useCallback((step: number) => {
    dispatch({ type: 'COMPLETE_STEP', payload: step });
  }, []);

  const updateData = useCallback((data: Partial<OnboardingData>) => {
    dispatch({ type: 'UPDATE_DATA', payload: data });
  }, []);

  const setError = useCallback((error: string | null) => {
    dispatch({ type: 'SET_ERROR', payload: error });
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    dispatch({ type: 'SET_LOADING', payload: loading });
  }, []);

  const reset = useCallback(() => {
    localStorage.removeItem(ONBOARDING_STORAGE_KEY);
    dispatch({ type: 'RESET' });
  }, []);

  const contextValue: OnboardingContextType = {
    ...state,
    goToStep,
    nextStep,
    previousStep,
    completeStep,
    updateData,
    setError,
    setLoading,
    reset,
    saveProgress,
    loadProgress,
  };

  return (
    <OnboardingContext.Provider value={contextValue}>
      {children}
    </OnboardingContext.Provider>
  );
};

export const useOnboarding = (): OnboardingContextType => {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
};
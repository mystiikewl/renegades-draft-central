// Onboarding types and interfaces

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  component: React.ComponentType<any>;
  validation?: () => boolean | Promise<boolean>;
  isRequired?: boolean;
}

export interface OnboardingState {
  currentStep: number;
  totalSteps: number;
  completedSteps: number[];
  isLoading: boolean;
  error: string | null;
  data: OnboardingData;
  progress: number;
}

export interface OnboardingData {
  selectedTeamId?: string;
  keepersSelected?: string[];
  preferences?: OnboardingPreferences;
  completedAt?: Date;
}

export interface OnboardingPreferences {
  notifications?: boolean;
  theme?: 'light' | 'dark' | 'auto';
  quickStart?: boolean;
}

export interface OnboardingContextType extends OnboardingState {
  goToStep: (step: number) => void;
  nextStep: () => void;
  previousStep: () => void;
  completeStep: (step: number) => void;
  updateData: (data: Partial<OnboardingData>) => void;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
  saveProgress: () => void;
  loadProgress: () => void;
}

export interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  className?: string;
}

export interface ProgressIndicatorProps {
  currentStep: number;
  totalSteps: number;
  completedSteps: number[];
  steps: Array<{ id: string; title: string; }>;
  onStepClick?: (step: number) => void;
  className?: string;
}

export interface SidebarProps {
  currentStep: number;
  leagueData?: LeagueData;
  className?: string;
}

export interface LeagueData {
  name: string;
  size: number;
  rosterSize: number;
  draftRounds: number;
  keeperLimit: number;
  draftType: string;
}

export interface OnboardingError {
  message: string;
  code?: string;
  step?: number;
  retry?: () => void;
}

export interface StepValidationResult {
  isValid: boolean;
  errors?: string[];
  warnings?: string[];
}

export type OnboardingAction =
  | { type: 'SET_STEP'; payload: number }
  | { type: 'COMPLETE_STEP'; payload: number }
  | { type: 'UPDATE_DATA'; payload: Partial<OnboardingData> }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'RESET' }
  | { type: 'LOAD_PROGRESS'; payload: Partial<OnboardingState> };
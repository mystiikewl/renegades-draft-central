import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { OnboardingProvider, useOnboarding } from '@/contexts/OnboardingContext';
import { ProgressIndicator } from './ProgressIndicator';
import { FeatureCard } from './FeatureCard';
import { LoadingState } from './LoadingState';

// Mock the useIsMobile hook
vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}));

// Test component that uses the onboarding context
const TestOnboardingConsumer = () => {
  const { currentStep, nextStep, completeStep, goToStep } = useOnboarding();
  return (
    <div>
      <span data-testid="current-step">{currentStep}</span>
      <button onClick={nextStep} data-testid="next-button">Next</button>
      <button onClick={() => completeStep(1)} data-testid="complete-button">Complete Step 1</button>
      <button onClick={() => goToStep(2)} data-testid="go-to-step-2">Go to Step 2</button>
    </div>
  );
};

describe('Onboarding Components', () => {
  describe('OnboardingProvider', () => {
    it('provides default onboarding state', () => {
      render(
        <OnboardingProvider>
          <TestOnboardingConsumer />
        </OnboardingProvider>
      );

      expect(screen.getByTestId('current-step')).toHaveTextContent('1');
    });

    it('handles step navigation', async () => {
      render(
        <OnboardingProvider>
          <TestOnboardingConsumer />
        </OnboardingProvider>
      );

      const nextButton = screen.getByTestId('next-button');
      fireEvent.click(nextButton);

      await waitFor(() => {
        expect(screen.getByTestId('current-step')).toHaveTextContent('2');
      });
    });

    it('handles step completion', async () => {
      render(
        <OnboardingProvider>
          <TestOnboardingConsumer />
        </OnboardingProvider>
      );

      const completeButton = screen.getByTestId('complete-button');
      fireEvent.click(completeButton);

      // Step should remain the same, but completion should be tracked
      expect(screen.getByTestId('current-step')).toHaveTextContent('1');
    });

    it('handles direct step navigation', async () => {
      render(
        <OnboardingProvider>
          <TestOnboardingConsumer />
        </OnboardingProvider>
      );

      const goToStep2Button = screen.getByTestId('go-to-step-2');
      fireEvent.click(goToStep2Button);

      await waitFor(() => {
        expect(screen.getByTestId('current-step')).toHaveTextContent('2');
      });
    });
  });

  describe('ProgressIndicator', () => {
    const mockSteps = [
      { id: 'step1', title: 'Step 1' },
      { id: 'step2', title: 'Step 2' },
    ];

    it('renders progress indicator correctly', () => {
      render(
        <ProgressIndicator
          currentStep={1}
          totalSteps={2}
          completedSteps={[1]}
          steps={mockSteps}
        />
      );

      expect(screen.getByText('Step 1')).toBeInTheDocument();
      expect(screen.getByText('Step 2')).toBeInTheDocument();
    });
  });

  describe('FeatureCard', () => {
    it('renders feature card with icon and content', () => {
      const testIcon = <span data-testid="test-icon">🔥</span>;

      render(
        <FeatureCard
          icon={testIcon}
          title="Test Feature"
          description="Test description"
        />
      );

      expect(screen.getByText('Test Feature')).toBeInTheDocument();
      expect(screen.getByText('Test description')).toBeInTheDocument();
      expect(screen.getByTestId('test-icon')).toBeInTheDocument();
    });
  });

  describe('LoadingState', () => {
    it('renders loading state with title and message', () => {
      render(
        <LoadingState
          title="Loading..."
          message="Please wait"
        />
      );

      expect(screen.getByText('Loading...')).toBeInTheDocument();
      expect(screen.getByText('Please wait')).toBeInTheDocument();
    });

    it('renders with different sizes', () => {
      render(<LoadingState size="lg" />);
      // Should render without crashing with different sizes
    });
  });
});
import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Sparkles,
  LayoutDashboard,
  Columns3,
  Clock,
  Settings,
  FileText,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useGuide } from './useGuide';
import { welcomeSteps } from './guideContent';

const iconMap: Record<string, typeof Sparkles> = {
  welcome: Sparkles,
  dashboard: LayoutDashboard,
  kanban: Columns3,
  time: Clock,
  'admin-settings': Settings,
  'admin-templates': FileText,
};

export function WelcomeWizard() {
  const { showWelcome, markWelcomeSeen, role } = useGuide();
  const [currentStep, setCurrentStep] = useState(0);

  // Filter steps based on user role
  const steps = useMemo(() => {
    return welcomeSteps.filter(step => !step.adminOnly || role === 'admin');
  }, [role]);

  const step = steps[currentStep];
  const Icon = (step && iconMap[step.id]) || Sparkles;
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      markWelcomeSeen();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirstStep) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSkip = () => {
    markWelcomeSeen();
  };

  if (!step) return null;

  return (
    <Dialog open={showWelcome} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center sm:text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--theme-primary)]/10">
            <Icon className="h-8 w-8 text-[var(--theme-primary)]" />
          </div>
          <DialogTitle className="text-xl">{step.title}</DialogTitle>
          <DialogDescription className="text-base leading-relaxed">
            {step.description}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex justify-center gap-1.5 py-4">
          {steps.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentStep(index)}
              className={`h-2 rounded-full transition-all ${
                index === currentStep
                  ? 'w-6 bg-[var(--theme-primary)]'
                  : 'w-2 bg-white/[0.08] hover:bg-white/[0.12]'
              }`}
              aria-label={`Go to step ${index + 1}`}
            />
          ))}
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between">
          <div>
            {!isFirstStep && (
              <Button variant="ghost" onClick={handlePrev}>
                <ChevronLeft className="mr-1 h-4 w-4" />
                Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {!isLastStep && (
              <Button variant="ghost" onClick={handleSkip}>
                Skip
              </Button>
            )}
            <Button onClick={handleNext}>
              {isLastStep ? (
                "Get Started"
              ) : (
                <>
                  Next
                  <ChevronRight className="ml-1 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

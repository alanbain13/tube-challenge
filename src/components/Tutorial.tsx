import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Map, Camera, Route, Activity, Check } from 'lucide-react';

interface TutorialStep {
  title: string;
  description: string;
  icon: React.ReactNode;
  action?: {
    label: string;
    path: string;
  };
}

const tutorialSteps: TutorialStep[] = [
  {
    title: 'Welcome to Tube Challenge!',
    description: 'Conquer the London Underground one station at a time. This quick tutorial will show you how to get started.',
    icon: <Map className="h-12 w-12 text-primary" />,
  },
  {
    title: 'Create Your Routes',
    description: 'Plan your journey by creating custom routes through the Underground. Add stations in order and save them for later.',
    icon: <Route className="h-12 w-12 text-primary" />,
    action: {
      label: 'Create Route',
      path: '/routes/create'
    }
  },
  {
    title: 'Start an Activity',
    description: 'Ready to go? Start an activity and choose a route. Track your progress in real-time as you visit each station.',
    icon: <Activity className="h-12 w-12 text-primary" />,
    action: {
      label: 'Start Activity',
      path: '/activities/new'
    }
  },
  {
    title: 'Check In at Stations',
    description: 'Take photos of station roundels to verify your visits. Our AI will automatically recognize the station from your photo.',
    icon: <Camera className="h-12 w-12 text-primary" />,
  },
  {
    title: 'You\'re All Set!',
    description: 'Start exploring the Underground and complete your tube challenge. Good luck!',
    icon: <Check className="h-12 w-12 text-primary" />,
  },
];

interface TutorialProps {
  open: boolean;
  onComplete: () => void;
}

export function Tutorial({ open, onComplete }: TutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const navigate = useNavigate();

  const progress = ((currentStep + 1) / tutorialSteps.length) * 100;
  const step = tutorialSteps[currentStep];
  const isLastStep = currentStep === tutorialSteps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  const handleAction = () => {
    if (step.action) {
      onComplete();
      navigate(step.action.path);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex flex-col items-center text-center mb-4">
            <div className="mb-4">
              {step.icon}
            </div>
            <DialogTitle className="text-2xl">{step.title}</DialogTitle>
            <DialogDescription className="mt-4 text-base">
              {step.description}
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Step {currentStep + 1} of {tutorialSteps.length}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <div className="flex w-full gap-2">
            {currentStep > 0 && (
              <Button
                variant="outline"
                onClick={handlePrevious}
                className="flex-1"
              >
                Previous
              </Button>
            )}
            
            {!isLastStep && (
              <Button
                variant="ghost"
                onClick={handleSkip}
                className="flex-1"
              >
                Skip
              </Button>
            )}

            {step.action && !isLastStep && (
              <Button
                onClick={handleAction}
                className="flex-1"
              >
                {step.action.label}
              </Button>
            )}

            <Button
              onClick={handleNext}
              className="flex-1"
            >
              {isLastStep ? 'Get Started' : 'Next'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

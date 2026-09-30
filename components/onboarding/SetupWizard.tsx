'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Sparkles, Zap } from 'lucide-react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  completeOnboarding,
  type CompleteOnboardingInput,
} from '@/app/actions/onboarding';
import { startGuidedTour } from '@/hooks/useTourState';
import {
  ONBOARDING_CREDIT_GRANT,
  ONBOARDING_INDUSTRIES,
} from '@/lib/onboarding/constants';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

type SetupWizardProps = {
  open: boolean;
};

const STEPS = [
  {
    title: 'Welcome & Team Scope',
    description:
      "Welcome to the Engine. Let's configure your strategic workspace.",
  },
  {
    title: 'Target Intent Mapping',
    description: 'What domain or niche are we building topical authority for?',
  },
  {
    title: 'Credit Provisioning & Activation',
    description:
      "Workspace Activated. We have credited your account with 100 Generation Credits. You're ready to map your niche.",
  },
] as const;

export default function SetupWizard({ open }: SetupWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [workspaceName, setWorkspaceName] = useState('');
  const [targetDomain, setTargetDomain] = useState('');
  const [primaryIndustry, setPrimaryIndustry] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentStep = STEPS[step];
  const isLastStep = step === STEPS.length - 1;

  function handleNext() {
    setError(null);

    if (step === 0 && !workspaceName.trim()) {
      setError('Please enter your workspace or company name.');
      return;
    }

    if (step === 1) {
      if (!targetDomain.trim()) {
        setError('Please enter your primary target domain.');
        return;
      }
      if (!primaryIndustry) {
        setError('Please select your primary industry or niche.');
        return;
      }
    }

    setStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  }

  function handleBack() {
    setError(null);
    setStep((prev) => Math.max(prev - 1, 0));
  }

  async function handleDeploy() {
    setError(null);
    setIsSubmitting(true);

    const payload: CompleteOnboardingInput = {
      workspaceName,
      targetDomain,
      primaryIndustry,
    };

    const result = await completeOnboarding(payload);

    if (!result.success) {
      setError(result.error);
      setIsSubmitting(false);
      return;
    }

    window.dispatchEvent(new Event('credits-updated'));
    router.push('/dashboard');
    router.refresh();
    window.setTimeout(() => {
      startGuidedTour();
    }, 800);
    setIsSubmitting(false);
  }

  return (
    <Dialog open={open} onOpenChange={() => undefined}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          onInteractOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => event.preventDefault()}
          className={cn(
            'fixed left-1/2 top-1/2 z-50 grid w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 gap-0 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 p-0 shadow-2xl shadow-black/40',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95'
          )}
        >
          <div className="border-b border-slate-800 bg-slate-900/80 px-6 py-5">
            <DialogHeader className="space-y-3 text-left">
              <div className="flex items-center gap-2">
                {STEPS.map((_, index) => (
                  <div
                    key={index}
                    className={cn(
                      'h-1.5 flex-1 rounded-full transition-colors',
                      index <= step ? 'bg-blue-500' : 'bg-slate-700'
                    )}
                  />
                ))}
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Step {step + 1} of {STEPS.length}
              </p>
              <DialogTitle className="text-2xl font-semibold tracking-tight text-white">
                {currentStep.title}
              </DialogTitle>
              <DialogDescription className="text-base leading-relaxed text-slate-300">
                {currentStep.description}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="space-y-6 px-6 py-6">
            {step === 0 ? (
              <div className="space-y-2">
                <Label htmlFor="workspace-name" className="text-slate-200">
                  Workspace / Company Name
                </Label>
                <Input
                  id="workspace-name"
                  value={workspaceName}
                  onChange={(event) => setWorkspaceName(event.target.value)}
                  placeholder="Acme Growth Labs"
                  className="border-slate-700 bg-slate-900 text-white placeholder:text-slate-500 focus-visible:ring-blue-500"
                  autoFocus
                />
              </div>
            ) : null}

            {step === 1 ? (
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="target-domain" className="text-slate-200">
                    Primary Target Domain
                  </Label>
                  <Input
                    id="target-domain"
                    value={targetDomain}
                    onChange={(event) => setTargetDomain(event.target.value)}
                    placeholder="yourdomain.com"
                    className="border-slate-700 bg-slate-900 text-white placeholder:text-slate-500 focus-visible:ring-blue-500"
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="primary-industry" className="text-slate-200">
                    Primary Industry / Niche
                  </Label>
                  <Select value={primaryIndustry} onValueChange={setPrimaryIndustry}>
                    <SelectTrigger
                      id="primary-industry"
                      className="border-slate-700 bg-slate-900 text-white focus:ring-blue-500"
                    >
                      <SelectValue placeholder="Select your niche" />
                    </SelectTrigger>
                    <SelectContent className="border-slate-700 bg-slate-900 text-white">
                      {ONBOARDING_INDUSTRIES.map((industry) => (
                        <SelectItem key={industry} value={industry}>
                          {industry}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="rounded-xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-500/15 ring-1 ring-blue-500/30">
                    <Sparkles className="h-7 w-7 text-blue-400" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium uppercase tracking-widest text-slate-400">
                      Generation Credits
                    </p>
                    <p className="text-4xl font-bold tabular-nums text-white">
                      {ONBOARDING_CREDIT_GRANT}
                    </p>
                    <p className="text-sm leading-relaxed text-slate-400">
                      Ready for Hub &amp; Spoke mapping, semantic analysis, and
                      your first topical architecture deployment.
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 rounded-lg border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-300">
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-400">Workspace</span>
                    <span className="font-medium text-white">{workspaceName}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-400">Target domain</span>
                    <span className="font-medium text-white">{targetDomain}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-400">Industry</span>
                    <span className="font-medium text-white">{primaryIndustry}</span>
                  </div>
                </div>
              </div>
            ) : null}

            {error ? (
              <p className="text-sm text-red-400" role="alert">
                {error}
              </p>
            ) : null}
          </div>

          <div className="flex items-center justify-between border-t border-slate-800 bg-slate-900/50 px-6 py-4">
            <Button
              type="button"
              variant="ghost"
              className="text-slate-300 hover:bg-slate-800 hover:text-white"
              onClick={handleBack}
              disabled={step === 0 || isSubmitting}
            >
              Back
            </Button>

            {isLastStep ? (
              <Button
                type="button"
                className="gap-2 bg-blue-600 text-white hover:bg-blue-500"
                onClick={() => void handleDeploy()}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Deploying...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4" />
                    Deploy Master Engine
                  </>
                )}
              </Button>
            ) : (
              <Button
                type="button"
                className="bg-blue-600 text-white hover:bg-blue-500"
                onClick={handleNext}
              >
                Continue
              </Button>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </Dialog>
  );
}

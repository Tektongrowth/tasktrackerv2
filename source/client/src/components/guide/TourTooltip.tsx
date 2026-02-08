import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { SpotlightStep } from './types';

interface TourTooltipProps {
  step: SpotlightStep;
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
  targetRect: DOMRect | null;
}

type Position = {
  top: number;
  left: number;
  placement: 'top' | 'bottom' | 'left' | 'right';
};

export function TourTooltip({
  step,
  currentStep,
  totalSteps,
  onNext,
  onPrev,
  onClose,
  targetRect,
}: TourTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<Position | null>(null);

  useEffect(() => {
    if (!targetRect || !tooltipRef.current) return;

    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const padding = 12;
    const viewportPadding = 16;

    // Calculate available space in each direction
    const spaceTop = targetRect.top - viewportPadding;
    const spaceBottom = window.innerHeight - targetRect.bottom - viewportPadding;
    const spaceLeft = targetRect.left - viewportPadding;
    const spaceRight = window.innerWidth - targetRect.right - viewportPadding;

    // Determine best placement
    let placement = step.placement || 'auto';
    if (placement === 'auto') {
      // Pick the direction with most space
      const spaces = [
        { dir: 'bottom' as const, space: spaceBottom },
        { dir: 'top' as const, space: spaceTop },
        { dir: 'right' as const, space: spaceRight },
        { dir: 'left' as const, space: spaceLeft },
      ];
      const best = spaces.reduce((a, b) => (b.space > a.space ? b : a));
      placement = best.dir;
    }

    let top = 0;
    let left = 0;

    switch (placement) {
      case 'top':
        top = targetRect.top - tooltipRect.height - padding;
        left = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;
        break;
      case 'bottom':
        top = targetRect.bottom + padding;
        left = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;
        break;
      case 'left':
        top = targetRect.top + targetRect.height / 2 - tooltipRect.height / 2;
        left = targetRect.left - tooltipRect.width - padding;
        break;
      case 'right':
        top = targetRect.top + targetRect.height / 2 - tooltipRect.height / 2;
        left = targetRect.right + padding;
        break;
    }

    // Constrain to viewport
    left = Math.max(viewportPadding, Math.min(left, window.innerWidth - tooltipRect.width - viewportPadding));
    top = Math.max(viewportPadding, Math.min(top, window.innerHeight - tooltipRect.height - viewportPadding));

    setPosition({ top, left, placement });
  }, [targetRect, step.placement]);

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;

  const tooltipContent = (
    <div
      ref={tooltipRef}
      className="fixed z-[10000] w-80 rounded-[var(--radius)] bg-white/[0.06] backdrop-blur-xl border border-white/[0.08] p-4 shadow-xl"
      style={{
        top: position?.top ?? -9999,
        left: position?.left ?? -9999,
        visibility: position ? 'visible' : 'hidden',
      }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute right-2 top-2 rounded-sm p-1 opacity-70 hover:opacity-100"
        aria-label="Close tour"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Content */}
      <div className="pr-6">
        <h3 className="mb-1 font-semibold text-white/90">{step.title}</h3>
        <p className="text-sm text-white/60">{step.description}</p>
      </div>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-white/40">
          {currentStep + 1} of {totalSteps}
        </span>
        <div className="flex gap-2">
          {!isFirstStep && (
            <Button variant="ghost" size="sm" onClick={onPrev}>
              <ChevronLeft className="mr-1 h-3 w-3" />
              Back
            </Button>
          )}
          <Button size="sm" onClick={onNext}>
            {isLastStep ? (
              'Done'
            ) : (
              <>
                Next
                <ChevronRight className="ml-1 h-3 w-3" />
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Arrow pointer based on position */}
      {position && (
        <div
          className={`absolute h-3 w-3 rotate-45 bg-white/[0.06] ${
            position.placement === 'top'
              ? 'bottom-[-6px] left-1/2 -translate-x-1/2'
              : position.placement === 'bottom'
              ? 'top-[-6px] left-1/2 -translate-x-1/2'
              : position.placement === 'left'
              ? 'right-[-6px] top-1/2 -translate-y-1/2'
              : 'left-[-6px] top-1/2 -translate-y-1/2'
          }`}
        />
      )}
    </div>
  );

  return createPortal(tooltipContent, document.body);
}

import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useGuide } from './useGuide';
import { spotlightTours } from './guideContent';
import { TourTooltip } from './TourTooltip';

export function SpotlightTour() {
  const { activeTour, currentTourStep, nextStep, prevStep, endTour } = useGuide();
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const tour = activeTour ? spotlightTours.find((t) => t.id === activeTour) : null;
  const step = tour?.steps[currentTourStep];

  // Find and track the target element
  const updateTargetRect = useCallback(() => {
    if (!step) {
      setTargetRect(null);
      return;
    }

    const element = document.querySelector(`[data-guide="${step.target}"]`);
    if (element) {
      setTargetRect(element.getBoundingClientRect());
      // Scroll element into view if needed
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      setTargetRect(null);
    }
  }, [step]);

  useEffect(() => {
    updateTargetRect();

    // Update on scroll and resize
    window.addEventListener('scroll', updateTargetRect, true);
    window.addEventListener('resize', updateTargetRect);

    // Also poll for element appearance (in case it's rendered dynamically)
    const pollInterval = setInterval(updateTargetRect, 500);

    return () => {
      window.removeEventListener('scroll', updateTargetRect, true);
      window.removeEventListener('resize', updateTargetRect);
      clearInterval(pollInterval);
    };
  }, [updateTargetRect]);

  // Handle escape key to close tour
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        endTour();
      }
    };

    if (activeTour) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeTour, endTour]);

  if (!activeTour || !tour || !step) return null;

  const padding = 8;

  return createPortal(
    <>
      {/* Dark overlay with cutout for spotlight effect */}
      {targetRect && (
        <div
          className="fixed inset-0 z-[9998] pointer-events-none"
          style={{
            background: 'transparent',
          }}
        >
          {/* Overlay pieces around the spotlight */}
          {/* Top */}
          <div
            className="absolute bg-black/70 pointer-events-auto"
            style={{
              top: 0,
              left: 0,
              right: 0,
              height: Math.max(0, targetRect.top - padding),
            }}
            onClick={endTour}
          />
          {/* Bottom */}
          <div
            className="absolute bg-black/70 pointer-events-auto"
            style={{
              top: targetRect.bottom + padding,
              left: 0,
              right: 0,
              bottom: 0,
            }}
            onClick={endTour}
          />
          {/* Left */}
          <div
            className="absolute bg-black/70 pointer-events-auto"
            style={{
              top: targetRect.top - padding,
              left: 0,
              width: Math.max(0, targetRect.left - padding),
              height: targetRect.height + padding * 2,
            }}
            onClick={endTour}
          />
          {/* Right */}
          <div
            className="absolute bg-black/70 pointer-events-auto"
            style={{
              top: targetRect.top - padding,
              left: targetRect.right + padding,
              right: 0,
              height: targetRect.height + padding * 2,
            }}
            onClick={endTour}
          />
          {/* Spotlight border/highlight */}
          <div
            className="absolute rounded-[var(--radius)] ring-4 ring-[var(--theme-primary)] ring-opacity-50 pointer-events-none"
            style={{
              top: targetRect.top - padding,
              left: targetRect.left - padding,
              width: targetRect.width + padding * 2,
              height: targetRect.height + padding * 2,
            }}
          />
        </div>
      )}

      {/* Fallback overlay when target not found */}
      {!targetRect && (
        <div
          className="fixed inset-0 z-[9998] bg-black/70"
          onClick={endTour}
        />
      )}

      {/* Tooltip */}
      <TourTooltip
        step={step}
        currentStep={currentTourStep}
        totalSteps={tour.steps.length}
        onNext={nextStep}
        onPrev={prevStep}
        onClose={endTour}
        targetRect={targetRect}
      />
    </>,
    document.body
  );
}

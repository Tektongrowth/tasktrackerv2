import { useState, useEffect } from 'react';
import { Bell, BellOff, X, Share, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { cn } from '@/lib/utils';

interface PushNotificationPromptProps {
  className?: string;
}

export function PushNotificationPrompt({ className }: PushNotificationPromptProps) {
  const {
    isSupported,
    isSubscribed,
    isLoading,
    permission,
    error,
    subscribe,
    needsInstall,
  } = usePushNotifications();

  const [dismissed, setDismissed] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  // Check if user has dismissed the prompt before
  useEffect(() => {
    const dismissedAt = localStorage.getItem('pushPromptDismissed');
    if (dismissedAt) {
      const daysSinceDismissed = (Date.now() - parseInt(dismissedAt)) / (1000 * 60 * 60 * 24);
      // Show again after 7 days
      if (daysSinceDismissed < 7) {
        setDismissed(true);
      }
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('pushPromptDismissed', Date.now().toString());
  };

  const handleSubscribe = async () => {
    const result = await subscribe();
    if (result.requiresInstall) {
      setShowIOSInstructions(true);
    }
  };

  // Don't show if not supported, already subscribed, or dismissed
  if (!isSupported || isSubscribed || dismissed || permission === 'denied') {
    return null;
  }

  // iOS PWA install instructions
  if (showIOSInstructions || needsInstall) {
    return (
      <div className={cn(
        "fixed bottom-20 left-4 right-4 md:left-auto md:right-6 md:bottom-6 md:w-96 bg-white rounded-xl shadow-xl border p-4 z-50",
        className
      )}>
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 p-1 hover:bg-muted rounded-full"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
            <Share className="h-5 w-5 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm">Install TaskTracker</h3>
            <p className="text-xs text-muted-foreground mt-1">
              To receive notifications on iOS, add this app to your home screen:
            </p>
            <ol className="mt-3 space-y-2 text-xs text-muted-foreground">
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium">1</span>
                Tap the <Share className="h-3 w-3 inline mx-1" /> Share button
              </li>
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium">2</span>
                Scroll and tap "Add to Home Screen" <Plus className="h-3 w-3 inline mx-1" />
              </li>
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium">3</span>
                Open the app from your home screen
              </li>
            </ol>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 w-full"
              onClick={handleDismiss}
            >
              Got it
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Regular push notification prompt
  return (
    <div className={cn(
      "fixed bottom-20 left-4 right-4 md:left-auto md:right-6 md:bottom-6 md:w-80 bg-white rounded-xl shadow-xl border p-4 z-50",
      className
    )}>
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 p-1 hover:bg-muted rounded-full"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-[var(--theme-accent)]/10 flex items-center justify-center flex-shrink-0">
          <Bell className="h-5 w-5 text-[var(--theme-accent)]" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm">Enable Notifications</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Get notified when you receive messages or are mentioned in comments.
          </p>
          {error && (
            <p className="text-xs text-red-500 mt-1">{error}</p>
          )}
          <div className="flex gap-2 mt-3">
            <Button
              size="sm"
              onClick={handleSubscribe}
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading ? 'Enabling...' : 'Enable'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDismiss}
            >
              Not now
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Settings component for managing push notifications
export function PushNotificationSettings() {
  const {
    isSupported,
    isSubscribed,
    isLoading,
    permission,
    error,
    subscribe,
    unsubscribe,
    needsInstall,
  } = usePushNotifications();

  if (!isSupported) {
    return (
      <div className="text-sm text-muted-foreground">
        Push notifications are not supported in this browser.
      </div>
    );
  }

  if (permission === 'denied') {
    return (
      <div className="text-sm text-muted-foreground">
        <BellOff className="h-4 w-4 inline mr-2" />
        Notifications are blocked. Please enable them in your browser settings.
      </div>
    );
  }

  if (needsInstall) {
    return (
      <div className="text-sm text-muted-foreground">
        <Bell className="h-4 w-4 inline mr-2" />
        Add this app to your home screen to enable notifications on iOS.
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {isSubscribed ? (
          <Bell className="h-4 w-4 text-green-500" />
        ) : (
          <BellOff className="h-4 w-4 text-muted-foreground" />
        )}
        <span className="text-sm">
          {isSubscribed ? 'Notifications enabled' : 'Notifications disabled'}
        </span>
      </div>
      <Button
        variant={isSubscribed ? 'outline' : 'default'}
        size="sm"
        onClick={isSubscribed ? unsubscribe : subscribe}
        disabled={isLoading}
      >
        {isLoading ? '...' : isSubscribed ? 'Disable' : 'Enable'}
      </Button>
      {error && (
        <p className="text-xs text-red-500 mt-1">{error}</p>
      )}
    </div>
  );
}


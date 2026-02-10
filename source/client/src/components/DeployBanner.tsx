import { useState, useEffect } from 'react';
import { Rocket, Sparkles } from 'lucide-react';
import { API_BASE } from '@/lib/api';

const SILLY_MESSAGES = [
  "Sprinkling magic deployment dust...",
  "Teaching the hamsters new tricks...",
  "Polishing pixels to perfection...",
  "Convincing the code to behave...",
  "Brewing fresh features...",
  "Upgrading your experience with extra awesome...",
  "Making things slightly more amazing...",
  "Deploying awesomeness at ludicrous speed...",
  "Feeding the deployment gremlins...",
  "Turning coffee into features...",
];

export function DeployBanner() {
  const [isDeploying, setIsDeploying] = useState(false);
  const [message, setMessage] = useState('');
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  useEffect(() => {
    const checkDeployStatus = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/deploy-status`, { credentials: 'include' });
        const data = await response.json();

        if (data.isDeploying) {
          setIsDeploying(true);
          setRemainingSeconds(Math.ceil(data.remainingMs / 1000));
          // Pick a random message on first load
          if (!message) {
            setMessage(SILLY_MESSAGES[Math.floor(Math.random() * SILLY_MESSAGES.length)]);
          }
        } else {
          setIsDeploying(false);
        }
      } catch {
        // Silently fail - don't show banner if we can't reach the API
        setIsDeploying(false);
      }
    };

    // Check immediately
    checkDeployStatus();

    // Then check every 30 seconds
    const interval = setInterval(checkDeployStatus, 30000);

    return () => clearInterval(interval);
  }, [message]);

  // Countdown timer
  useEffect(() => {
    if (!isDeploying || remainingSeconds <= 0) return;

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          setIsDeploying(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isDeploying, remainingSeconds]);

  if (!isDeploying) return null;

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;

  return (
    <div className="bg-gradient-to-r from-red-500 via-pink-500 to-purple-500 text-white px-4 py-2 text-center text-sm font-medium animate-pulse">
      <div className="flex items-center justify-center gap-2 flex-wrap">
        <Rocket className="h-4 w-4 animate-bounce" />
        <span>{message}</span>
        <Sparkles className="h-4 w-4" />
        <span className="opacity-75 text-xs">
          (Things might be wonky for {minutes}:{seconds.toString().padStart(2, '0')})
        </span>
      </div>
    </div>
  );
}

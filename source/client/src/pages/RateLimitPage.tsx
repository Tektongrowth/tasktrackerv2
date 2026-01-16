import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, RefreshCw } from 'lucide-react';

export function RateLimitPage() {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(60);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleTryAgain = () => {
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
            <Clock className="h-8 w-8 text-amber-600" />
          </div>
          <CardTitle className="text-2xl">Slow Down There!</CardTitle>
          <CardDescription className="text-base mt-2">
            Too many login attempts detected. This is a security measure to protect your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-slate-50 rounded-lg p-4">
            <p className="text-sm text-slate-600 mb-2">What happened?</p>
            <p className="text-sm text-slate-500">
              Our system limits login attempts to prevent unauthorized access.
              You've temporarily exceeded this limit.
            </p>
          </div>

          <div className="bg-amber-50 rounded-lg p-4">
            <p className="text-sm text-amber-800 font-medium mb-1">
              Please wait before trying again
            </p>
            <p className="text-sm text-amber-600">
              The limit resets every 15 minutes. Take a short break and try again.
            </p>
          </div>

          {countdown > 0 ? (
            <div className="text-center">
              <p className="text-sm text-slate-500 mb-2">Suggested wait time:</p>
              <p className="text-3xl font-bold text-slate-700">
                {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}
              </p>
            </div>
          ) : (
            <Button onClick={handleTryAgain} className="w-full" size="lg">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          )}

          {countdown > 0 && (
            <Button variant="outline" onClick={handleTryAgain} className="w-full">
              Back to Login
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

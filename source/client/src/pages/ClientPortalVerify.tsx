import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { clientPortal } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export function ClientPortalVerify() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setError('Invalid access link');
      return;
    }

    clientPortal.verify(token)
      .then(() => {
        setStatus('success');
        // Redirect to dashboard after a short delay
        setTimeout(() => {
          navigate('/client-portal/dashboard');
        }, 2000);
      })
      .catch((err) => {
        setStatus('error');
        setError(err.message || 'Failed to verify access link');
      });
  }, [token, navigate]);

  if (status === 'verifying') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white/[0.03] p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <Loader2 className="h-12 w-12 text-primary animate-spin" />
            </div>
            <CardTitle>Verifying Access</CardTitle>
            <CardDescription>Please wait while we verify your access link...</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white/[0.03] p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-green-500/15 rounded-full flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-green-400" />
              </div>
            </div>
            <CardTitle>Access Verified</CardTitle>
            <CardDescription>Redirecting to your dashboard...</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white/[0.03] p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-red-500/15 rounded-full flex items-center justify-center">
              <XCircle className="h-8 w-8 text-red-400" />
            </div>
          </div>
          <CardTitle>Verification Failed</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => navigate('/client-portal')}>
            Request New Access Link
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

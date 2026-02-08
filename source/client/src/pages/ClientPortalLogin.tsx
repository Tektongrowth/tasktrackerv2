import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { clientPortal } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/toaster';
import { Mail, ArrowLeft } from 'lucide-react';

export function ClientPortalLogin() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const navigate = useNavigate();

  const requestAccess = useMutation({
    mutationFn: () => clientPortal.requestAccess(email),
    onSuccess: () => {
      setSubmitted(true);
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: 'destructive' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({ title: 'Please enter your email', variant: 'destructive' });
      return;
    }
    requestAccess.mutate();
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white/[0.03] p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-12 h-12 bg-green-500/15 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="h-6 w-6 text-green-400" />
            </div>
            <CardTitle>Check Your Email</CardTitle>
            <CardDescription className="mt-2">
              If your email is associated with a client account, you'll receive an access link shortly.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-white/60 mb-4">
              The link will expire in 24 hours and can only be used once.
            </p>
            <Button variant="outline" onClick={() => { setSubmitted(false); setEmail(''); }}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Try Another Email
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white/[0.03] p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Client Portal</CardTitle>
          <CardDescription>
            Enter your email to access your project dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
              />
              <p className="text-xs text-white/60">
                Use the email associated with your subscription
              </p>
            </div>
            <Button type="submit" className="w-full" disabled={requestAccess.isPending}>
              {requestAccess.isPending ? 'Sending...' : 'Request Access Link'}
            </Button>
          </form>
          <div className="mt-6 text-center">
            <Button variant="link" onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type SharePasswordGateProps = {
  shareToken: string;
};

export default function SharePasswordGate({ shareToken }: SharePasswordGateProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/client-share/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareToken, password }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? 'Incorrect password');
      }
      window.location.reload();
    } catch (unlockError) {
      setError(unlockError instanceof Error ? unlockError.message : 'Unlock failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-6"
      >
        <div>
          <h1 className="text-lg font-semibold text-white">Password required</h1>
          <p className="mt-1 text-sm text-slate-400">
            This client report is protected. Enter the password shared by your agency.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="share-password" className="text-slate-200">
            Password
          </Label>
          <Input
            id="share-password"
            type="password"
            value={password}
            onChange={event => setPassword(event.target.value)}
            className="border-slate-700 bg-slate-950 text-white"
            autoFocus
          />
        </div>
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        <Button type="submit" disabled={loading || !password.trim()} className="w-full">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          View report
        </Button>
      </form>
    </div>
  );
}

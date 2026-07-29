import { redirect } from 'next/navigation';
import LoginClient from '@/components/auth/LoginClient';
import { isGoogleAuthConfigured } from '@/lib/auth';
import { getAuthenticatedSession } from '@/lib/projects/authenticated-workspace';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const session = await getAuthenticatedSession();

  if (session) {
    redirect('/dashboard');
  }

  return <LoginClient googleAuthEnabled={isGoogleAuthConfigured()} />;
}

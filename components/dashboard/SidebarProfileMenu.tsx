"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronUp, LogOut, Settings, Shield } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { getCurrentUserPlatformRole } from '@/app/actions/admin';
import { useTeamAccess } from '@/components/team/TeamAccessProvider';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

function getInitials(name: string, email: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  if (parts.length === 1 && parts[0].length >= 2) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

function ProfileMenuSkeleton() {
  return (
    <div className="border-t border-border px-2 py-2">
      <div
        aria-hidden
        className="flex w-full animate-pulse items-center gap-2.5 rounded-md px-2 py-2"
      >
        <div className="h-7 w-7 shrink-0 rounded-full bg-muted" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="h-3 w-24 rounded bg-muted" />
          <div className="h-2.5 w-16 rounded bg-muted/70" />
        </div>
        <div className="h-3.5 w-3.5 shrink-0 rounded bg-muted/70" />
      </div>
    </div>
  );
}

export default function SidebarProfileMenu() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [mounted, setMounted] = useState(false);
  const [platformRole, setPlatformRole] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    getCurrentUserPlatformRole().then(setPlatformRole);
  }, []);

  const { isViewer } = useTeamAccess();
  const user = session?.user;
  const name = user?.name ?? 'Guest';
  const email = user?.email ?? '';
  const image = user?.image ?? undefined;
  const initials = getInitials(name, email || 'U');

  async function handleSignOut() {
    await authClient.signOut();
    router.push('/');
    router.refresh();
  }

  if (!mounted || isPending) {
    return <ProfileMenuSkeleton />;
  }

  if (!user) {
    return (
      <div className="border-t border-border px-2 py-2">
        <Link
          href="/"
          className="block rounded-md px-2 py-2 text-xs font-medium text-emerald-600 transition-colors hover:bg-muted hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="border-t border-border px-2 py-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              'group flex w-full items-center gap-2.5 rounded-md border border-transparent px-2 py-2 text-left transition-colors',
              'hover:border-emerald-200 hover:bg-emerald-50/60',
              'dark:hover:border-emerald-500/25 dark:hover:bg-emerald-950/60',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40',
              'data-[state=open]:border-emerald-200 data-[state=open]:bg-emerald-50/60',
              'dark:data-[state=open]:border-emerald-500/30 dark:data-[state=open]:bg-emerald-950/70'
            )}
          >
            <Avatar className="h-7 w-7 shrink-0">
              {image ? <AvatarImage src={image} alt={name} /> : null}
              <AvatarFallback className="bg-emerald-600 text-[10px] font-bold text-white">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-foreground group-data-[state=open]:text-emerald-800 dark:group-data-[state=open]:text-emerald-200">
                {name}
              </p>
              <p className="truncate text-[10px] text-muted-foreground group-data-[state=open]:text-emerald-700/80 dark:group-data-[state=open]:text-emerald-400/80">
                {email}
              </p>
            </div>
            <ChevronUp
              size={14}
              className="shrink-0 text-muted-foreground group-data-[state=open]:text-emerald-600 dark:group-data-[state=open]:text-emerald-400"
            />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="mb-1 w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-0.5">
              <p className="text-sm font-medium leading-none">{name}</p>
              <p className="text-xs leading-none text-muted-foreground">{email}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/settings" className="cursor-pointer">
              <Settings className="mr-2 h-4 w-4" />
              {isViewer ? 'Client Portal' : 'Settings'}
            </Link>
          </DropdownMenuItem>
          {!isViewer && (platformRole === 'ADMIN' || platformRole === 'SUPER_ADMIN') && (
            <DropdownMenuItem asChild>
              <Link href="/admin" className="cursor-pointer">
                <Shield className="mr-2 h-4 w-4" />
                Admin Console
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="cursor-pointer text-red-600 focus:text-red-600"
            onClick={handleSignOut}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState, useTransition } from 'react';
import type { SettingsBundle } from '@/app/actions/settings';
import { getSettingsBundle } from '@/app/actions/settings';
import AccountTab from '@/components/settings/tabs/AccountTab';
import AiTab from '@/components/settings/tabs/AiTab';
import TrackingTab from '@/components/settings/tabs/TrackingTab';
import IntegrationsTab from '@/components/settings/tabs/IntegrationsTab';
import AlertsTab from '@/components/settings/tabs/AlertsTab';
import AgencyTab from '@/components/settings/tabs/AgencyTab';
import BillingTab from '@/components/settings/tabs/BillingTab';
import AeoBrandTab from '@/components/settings/tabs/AeoBrandTab';
import DomainManifestTab from '@/components/settings/tabs/DomainManifestTab';
import ClientPortalTab from '@/components/settings/tabs/ClientPortalTab';
import { useTeamAccess } from '@/components/team/TeamAccessProvider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  Bell,
  Bot,
  Building2,
  CreditCard,
  FileCode2,
  Globe,
  Plug,
  Target,
  User,
} from 'lucide-react';

const STAFF_TAB_ITEMS = [
  { value: 'account', label: 'Account, Team & Security', icon: User },
  { value: 'ai', label: 'AI & LLM Engine', icon: Bot },
  { value: 'aeo-brand', label: 'Client Brands (AEO)', icon: Target },
  { value: 'domain-manifest', label: 'Domain Manifest', icon: FileCode2 },
  { value: 'tracking', label: 'Global Tracking Defaults', icon: Globe },
  { value: 'integrations', label: 'Integrations & Apps', icon: Plug },
  { value: 'alerts', label: 'Alerts & Notifications', icon: Bell },
  { value: 'agency', label: 'Agency & White-Label', icon: Building2 },
  { value: 'billing', label: 'Data, Billing & Danger Zone', icon: CreditCard },
] as const;

const VIEWER_TAB_ITEMS = [
  { value: 'client-portal', label: 'Client Portal', icon: User },
] as const;

type StaffTabValue = (typeof STAFF_TAB_ITEMS)[number]['value'];
type ViewerTabValue = (typeof VIEWER_TAB_ITEMS)[number]['value'];
type TabValue = StaffTabValue | ViewerTabValue;

type SettingsClientProps = {
  initialData: SettingsBundle;
};

export default function SettingsClient({ initialData }: SettingsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isViewer } = useTeamAccess();
  const tabItems = isViewer ? VIEWER_TAB_ITEMS : STAFF_TAB_ITEMS;
  const tabValues = new Set(tabItems.map(item => item.value));
  const [data, setData] = useState(initialData);
  const [version, setVersion] = useState(0);
  const [, startTransition] = useTransition();

  const activeTab = useMemo(() => {
    const requested = searchParams.get('tab');
    if (requested && tabValues.has(requested as TabValue)) {
      return requested as TabValue;
    }
    return (isViewer ? 'client-portal' : 'account') satisfies TabValue;
  }, [isViewer, searchParams, tabValues]);

  const refresh = useCallback(() => {
    startTransition(async () => {
      try {
        const fresh = await getSettingsBundle();
        setData(fresh);
        setVersion(v => v + 1);
        router.refresh();
      } catch {
        router.refresh();
      }
    });
  }, [router]);

  function handleTabChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    const defaultTab = isViewer ? 'client-portal' : 'account';
    if (value === defaultTab) {
      params.delete('tab');
    } else {
      params.set('tab', value);
    }
    const qs = params.toString();
    router.replace(qs ? `/settings?${qs}` : '/settings', { scroll: false });
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {isViewer ? 'Client Portal' : 'Settings'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isViewer
            ? 'Your assigned client brand and read-only portal preferences.'
            : 'Manage your workspace, AI engine, integrations, and team preferences.'}
        </p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        orientation="vertical"
        className="flex flex-col gap-6 lg:flex-row lg:gap-10"
      >
        <TabsList
          className={cn(
            'flex h-auto w-full flex-row overflow-x-auto lg:w-56 lg:flex-col lg:items-stretch',
            'justify-start gap-1 rounded-xl border border-border bg-card p-2 shadow-sm'
          )}
        >
          {tabItems.map(item => {
            const Icon = item.icon;
            return (
              <TabsTrigger
                key={item.value}
                value={item.value}
                className={cn(
                  'justify-start gap-2 px-3 py-2.5 text-left text-sm whitespace-nowrap',
                  'data-[state=active]:bg-emerald-50 data-[state=active]:font-semibold data-[state=active]:text-emerald-700',
                  'dark:data-[state=active]:bg-emerald-950/40 dark:data-[state=active]:text-emerald-300'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        <div className="min-w-0 flex-1">
          {isViewer ? (
            <TabsContent value="client-portal" className="mt-0">
              <ClientPortalTab key={`client-portal-${version}`} data={data} />
            </TabsContent>
          ) : (
            <>
          <TabsContent value="account" className="mt-0">
            <AccountTab key={`account-${version}`} data={data} onRefresh={refresh} />
          </TabsContent>
          <TabsContent value="ai" className="mt-0">
            <AiTab key={`ai-${version}`} data={data} onRefresh={refresh} />
          </TabsContent>
          <TabsContent value="aeo-brand" className="mt-0">
            <AeoBrandTab key={`aeo-brand-${version}`} />
          </TabsContent>
          <TabsContent value="domain-manifest" className="mt-0">
            <DomainManifestTab key={`domain-manifest-${version}`} />
          </TabsContent>
          <TabsContent value="tracking" className="mt-0">
            <TrackingTab key={`tracking-${version}`} data={data} onRefresh={refresh} />
          </TabsContent>
          <TabsContent value="integrations" className="mt-0">
            <IntegrationsTab key={`integrations-${version}`} data={data} onRefresh={refresh} />
          </TabsContent>
          <TabsContent value="alerts" className="mt-0">
            <AlertsTab key={`alerts-${version}`} data={data} onRefresh={refresh} />
          </TabsContent>
          <TabsContent value="agency" className="mt-0">
            <AgencyTab key={`agency-${version}`} data={data} onRefresh={refresh} />
          </TabsContent>
          <TabsContent value="billing" className="mt-0">
            <BillingTab key={`billing-${version}`} data={data} />
          </TabsContent>
            </>
          )}
        </div>
      </Tabs>
    </div>
  );
}

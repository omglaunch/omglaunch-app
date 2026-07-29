'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { BookOpen, Link2, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import type { SettingsBundle } from '@/app/actions/settings';
import { updateIntegrationConfig } from '@/app/actions/settings';
import SecureApiKeyInput from '@/components/settings/SecureApiKeyInput';
import SettingsSection from '@/components/settings/SettingsSection';
import {
  TEST_CONNECTION_FAILURE_MESSAGE,
  TEST_CONNECTION_SUCCESS_MESSAGE,
  testSettingsConnection,
} from '@/lib/settings/test-connection-client';
import { testManifestWebhook } from '@/lib/integrations/manifest-webhook-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

type IntegrationsTabProps = {
  data: SettingsBundle;
  onRefresh: () => void;
};

export default function IntegrationsTab({ data, onRefresh }: IntegrationsTabProps) {
  const [isPending, startTransition] = useTransition();
  const [testingDfs, setTestingDfs] = useState(false);
  const [dfsLogin, setDfsLogin] = useState(data.integrations.dataForSeoLogin ?? '');
  const [dfsPassword, setDfsPassword] = useState('');
  const [wpUrl, setWpUrl] = useState(data.integrations.wordpressSiteUrl ?? '');
  const [wpUser, setWpUser] = useState(data.integrations.wordpressUsername ?? '');
  const [wpPassword, setWpPassword] = useState('');
  const [webhooks, setWebhooks] = useState<string[]>(data.integrations.webhookUrls);
  const [newWebhook, setNewWebhook] = useState('');
  const [testingWebhookIndex, setTestingWebhookIndex] = useState<number | null>(null);

  function save(partial: Parameters<typeof updateIntegrationConfig>[0]) {
    startTransition(async () => {
      try {
        await updateIntegrationConfig(partial);
        toast.success('Integration settings saved');
        setDfsPassword('');
        setWpPassword('');
        onRefresh();
      } catch {
        toast.error('Failed to save integration settings');
      }
    });
  }

  async function testDfs() {
    setTestingDfs(true);
    try {
      const useSavedPassword =
        data.integrations.dataForSeoPassword.isSet && !dfsPassword.trim();
      const result = await testSettingsConnection({
        provider: 'dataforseo',
        apiLogin: dfsLogin,
        apiPassword: useSavedPassword ? undefined : dfsPassword,
        useSaved: useSavedPassword,
      });
      if (result.success) {
        toast.success(TEST_CONNECTION_SUCCESS_MESSAGE);
      } else {
        toast.error(TEST_CONNECTION_FAILURE_MESSAGE);
      }
    } catch {
      toast.error(TEST_CONNECTION_FAILURE_MESSAGE);
    } finally {
      setTestingDfs(false);
    }
  }

  function addWebhook() {
    const url = newWebhook.trim();
    if (!url) return;
    const next = [...webhooks, url];
    setWebhooks(next);
    setNewWebhook('');
    save({ webhookUrls: next });
  }

  function removeWebhook(index: number) {
    const next = webhooks.filter((_, i) => i !== index);
    setWebhooks(next);
    save({ webhookUrls: next });
  }

  async function testWebhook(url: string, index: number) {
    setTestingWebhookIndex(index);
    try {
      const result = await testManifestWebhook(url);
      if (result.success) {
        toast.success(result.message ?? 'Webhook test delivered.');
      } else {
        toast.error(result.message ?? 'Webhook test failed.');
      }
    } catch {
      toast.error('Webhook test failed.');
    } finally {
      setTestingWebhookIndex(null);
    }
  }

  return (
    <div className="space-y-6">
      <SettingsSection
        title="SEO Data Providers"
        description="DataForSEO credentials for rank and keyword data."
      >
        <div className="space-y-2">
          <Label htmlFor="dfs-login">DataForSEO API Login</Label>
          <Input
            id="dfs-login"
            value={dfsLogin}
            onChange={event => setDfsLogin(event.target.value)}
            onBlur={() => save({ dataForSeoLogin: dfsLogin })}
          />
        </div>
        <SecureApiKeyInput
          id="dfs-password"
          label="DataForSEO API Password"
          isSet={data.integrations.dataForSeoPassword.isSet}
          value={dfsPassword}
          onChange={setDfsPassword}
          onTest={testDfs}
          isTesting={testingDfs}
        />
        <button
          type="button"
          className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
          onClick={() => save({ dataForSeoLogin: dfsLogin, dataForSeoPassword: dfsPassword })}
          disabled={isPending}
        >
          Save DataForSEO Credentials
        </button>
      </SettingsSection>

      <SettingsSection
        title="Data Sources"
        description="OAuth connections — placeholders for future Google integrations."
      >
        {[
          {
            key: 'gsc' as const,
            label: 'Google Search Console',
            connected: data.integrations.googleSearchConsoleConnected,
            field: 'googleSearchConsoleConnected' as const,
          },
          {
            key: 'ga4' as const,
            label: 'Google Analytics 4',
            connected: data.integrations.googleAnalyticsConnected,
            field: 'googleAnalyticsConnected' as const,
          },
          {
            key: 'gbp' as const,
            label: 'Google Business Profile',
            connected: data.integrations.googleBusinessProfileConnected,
            field: 'googleBusinessProfileConnected' as const,
          },
        ].map(item => (
          <div key={item.key} className="flex items-center justify-between gap-4 rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                <Link2 className="h-4 w-4 text-gray-500" />
              </div>
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">
                  {item.connected ? 'Connected' : 'Not connected'}
                </p>
              </div>
            </div>
            <Button
              variant={item.connected ? 'outline' : 'default'}
              size="sm"
              onClick={() => save({ [item.field]: !item.connected })}
            >
              {item.connected ? 'Disconnect' : 'Connect'}
            </Button>
          </div>
        ))}
      </SettingsSection>

      <SettingsSection title="CMS Auth (WordPress)" description="Enable REST API publishing to WordPress.">
        <div className="space-y-2">
          <Label htmlFor="wp-url">WordPress Site URL</Label>
          <Input
            id="wp-url"
            placeholder="https://yoursite.com"
            value={wpUrl}
            onChange={event => setWpUrl(event.target.value)}
            onBlur={() => save({ wordpressSiteUrl: wpUrl })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="wp-user">Username</Label>
          <Input
            id="wp-user"
            value={wpUser}
            onChange={event => setWpUser(event.target.value)}
            onBlur={() => save({ wordpressUsername: wpUser })}
          />
        </div>
        <SecureApiKeyInput
          id="wp-password"
          label="Application Password"
          isSet={data.integrations.wordpressAppPassword.isSet}
          value={wpPassword}
          onChange={setWpPassword}
        />
        <button
          type="button"
          className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
          onClick={() =>
            save({
              wordpressSiteUrl: wpUrl,
              wordpressUsername: wpUser,
              wordpressAppPassword: wpPassword,
            })
          }
          disabled={isPending}
        >
          Save WordPress Credentials
        </button>
      </SettingsSection>

      <SettingsSection
        title="Webhooks (Automation)"
        description="On manifest publish, omglaunch POSTs the published JSON to these URLs. Use Zapier, Make, or a custom script to write the file to the client site."
      >
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href="/settings/webhook-guide">
              <BookOpen className="mr-1.5 h-3.5 w-3.5" />
              Deploy recipes (Zapier, Make, Cloudflare)
            </Link>
          </Button>
        </div>
        <div className="space-y-2">
          {webhooks.map((url, index) => (
            <div key={`${url}-${index}`} className="flex items-center gap-2">
              <Input value={url} readOnly className="bg-muted" />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={testingWebhookIndex !== null}
                onClick={() => void testWebhook(url, index)}
              >
                {testingWebhookIndex === index ? (
                  <>
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    Testing…
                  </>
                ) : (
                  'Test'
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeWebhook(index)}
                aria-label="Remove webhook"
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="https://hooks.zapier.com/..."
            value={newWebhook}
            onChange={event => setNewWebhook(event.target.value)}
          />
          <Button type="button" variant="outline" onClick={addWebhook} disabled={!newWebhook.trim()}>
            <Plus className="mr-1 h-4 w-4" />
            Add
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Test sends a sample <code className="rounded bg-muted px-1">manifest.test</code> payload so you
          can verify Zapier/Make/Worker wiring before publishing.
        </p>
      </SettingsSection>
    </div>
  );
}

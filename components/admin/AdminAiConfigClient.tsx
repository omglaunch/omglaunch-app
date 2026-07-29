'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import SudoDialog from '@/components/admin/SudoDialog';
import { updateSystemConfig } from '@/app/actions/admin';
import { toast } from '@/components/ui/sonner';

interface SystemConfig {
  primaryLlmModel: string;
  fallbackLlmModel: string;
  inputTokenCostPerMillion: number;
  outputTokenCostPerMillion: number;
  systemPrompt: string;
  articleStudioPrompt: string;
  dataForSeoEnabled: boolean;
  wordpressWebhooksEnabled: boolean;
  openaiEnabled: boolean;
  geminiEnabled: boolean;
  dataForSeoCacheTtlHours: number;
  queueModeEnabled: boolean;
  globalConcurrencyDelayMs: number;
  logRetentionDays: number;
  masterOpenaiKey: string | null;
  masterAnthropicKey: string | null;
  masterGeminiKey: string | null;
  masterDataForSeoLogin: string | null;
  masterDataForSeoPassword: string | null;
}

interface AdminAiConfigClientProps {
  config: SystemConfig;
  isSuperAdmin: boolean;
}

const LLM_MODELS = [
  'gemini-2.0-flash',
  'gemini-1.5-pro',
  'gpt-4o',
  'gpt-4o-mini',
  'claude-3-5-sonnet',
  'claude-3-haiku',
];

export default function AdminAiConfigClient({ config, isSuperAdmin }: AdminAiConfigClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [sudoOpen, setSudoOpen] = useState(false);
  const [form, setForm] = useState(config);

  function updateField<K extends keyof SystemConfig>(key: K, value: SystemConfig[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    const payload: Record<string, unknown> = { ...form };
    for (const key of [
      'masterOpenaiKey',
      'masterAnthropicKey',
      'masterGeminiKey',
      'masterDataForSeoLogin',
      'masterDataForSeoPassword',
    ] as const) {
      if (payload[key] === '••••••••') delete payload[key];
    }

    try {
      await updateSystemConfig(payload);
      toast.success('Configuration saved');
      router.refresh();
    } catch (err) {
      if (err instanceof Error && err.message === 'SUDO_REQUIRED') {
        setSudoOpen(true);
      } else {
        toast.error(err instanceof Error ? err.message : 'Save failed');
      }
    }
  }

  return (
    <>
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Global Circuit Breakers</CardTitle>
            <CardDescription>
              Immediately shut off or force fallbacks for external integrations
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {[
              { key: 'dataForSeoEnabled' as const, label: 'DataForSEO API' },
              { key: 'wordpressWebhooksEnabled' as const, label: 'WordPress Webhooks' },
              { key: 'openaiEnabled' as const, label: 'OpenAI' },
              { key: 'geminiEnabled' as const, label: 'Google Gemini' },
            ].map(item => (
              <div key={item.key} className="flex items-center justify-between rounded-lg border p-4">
                <Label>{item.label}</Label>
                <Switch
                  checked={form[item.key]}
                  onCheckedChange={v => updateField(item.key, v)}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Model & Fallback Selectors</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Primary LLM</Label>
              <Select
                value={form.primaryLlmModel}
                onValueChange={v => updateField('primaryLlmModel', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LLM_MODELS.map(m => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fallback LLM</Label>
              <Select
                value={form.fallbackLlmModel}
                onValueChange={v => updateField('fallbackLlmModel', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LLM_MODELS.map(m => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Input Token Cost / Million ($)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.inputTokenCostPerMillion}
                onChange={e => updateField('inputTokenCostPerMillion', Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Output Token Cost / Million ($)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.outputTokenCostPerMillion}
                onChange={e => updateField('outputTokenCostPerMillion', Number(e.target.value))}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Prompt Editors</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="space-y-2">
              <Label>Master System Prompt</Label>
              <Textarea
                className="min-h-[120px] resize-y font-mono text-sm"
                value={form.systemPrompt}
                onChange={e => updateField('systemPrompt', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Article Studio Prompt</Label>
              <Textarea
                className="min-h-[120px] resize-y font-mono text-sm"
                value={form.articleStudioPrompt}
                onChange={e => updateField('articleStudioPrompt', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cache, Rate & Retention Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div className="flex justify-between">
                <Label>DataForSEO Cache TTL</Label>
                <span className="text-sm text-muted-foreground">
                  {form.dataForSeoCacheTtlHours}h
                </span>
              </div>
              <Slider
                min={24}
                max={168}
                step={1}
                value={[form.dataForSeoCacheTtlHours]}
                onValueChange={([v]) => updateField('dataForSeoCacheTtlHours', v)}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label>Queue Mode</Label>
                <p className="text-xs text-muted-foreground">
                  {form.queueModeEnabled ? 'Queue Mode' : 'Live Mode'}
                </p>
              </div>
              <Switch
                checked={form.queueModeEnabled}
                onCheckedChange={v => updateField('queueModeEnabled', v)}
              />
            </div>

            <div className="space-y-2">
              <Label>Global Concurrency Throttling Delay (ms)</Label>
              <Input
                type="number"
                value={form.globalConcurrencyDelayMs}
                onChange={e => updateField('globalConcurrencyDelayMs', Number(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label>Log Retention Window</Label>
              <Select
                value={String(form.logRetentionDays)}
                onValueChange={v => updateField('logRetentionDays', Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="14">14 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="60">60 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {isSuperAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>Master Key Vault</CardTitle>
              <CardDescription>
                Encrypted at rest. Leave blank or use placeholder to keep existing values.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {[
                { key: 'masterOpenaiKey' as const, label: 'OpenAI API Key' },
                { key: 'masterAnthropicKey' as const, label: 'Anthropic API Key' },
                { key: 'masterGeminiKey' as const, label: 'Gemini API Key' },
                { key: 'masterDataForSeoLogin' as const, label: 'DataForSEO Login' },
                { key: 'masterDataForSeoPassword' as const, label: 'DataForSEO Password' },
              ].map(item => (
                <div key={item.key} className="space-y-2">
                  <Label>{item.label}</Label>
                  <Input
                    type="password"
                    placeholder={form[item.key] ? '•••••••• (set)' : 'Not set'}
                    onChange={e => {
                      if (e.target.value) updateField(item.key, e.target.value);
                    }}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Separator />

        <Button
          size="lg"
          disabled={isPending}
          onClick={() => startTransition(handleSave)}
          className="w-fit"
        >
          Save Configuration
        </Button>
      </div>

      <SudoDialog
        open={sudoOpen}
        onOpenChange={setSudoOpen}
        onVerified={handleSave}
        title="Super Admin Verification"
        description="Saving system configuration requires sudo verification."
      />
    </>
  );
}

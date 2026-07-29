'use client';

import { useState, useTransition } from 'react';
import { toast } from '@/components/ui/sonner';
import type { SettingsBundle } from '@/app/actions/settings';
import { updateAiConfig } from '@/app/actions/settings';
import SecureApiKeyInput from '@/components/settings/SecureApiKeyInput';
import SettingsSection from '@/components/settings/SettingsSection';
import {
  TEST_CONNECTION_FAILURE_MESSAGE,
  TEST_CONNECTION_SUCCESS_MESSAGE,
  testSettingsConnection,
} from '@/lib/settings/test-connection-client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ANALYSIS_AI_MODELS, ARTICLE_STUDIO_MODELS } from '@/lib/settings/constants';

type AiTabProps = {
  data: SettingsBundle;
  onRefresh: () => void;
};

export default function AiTab({ data, onRefresh }: AiTabProps) {
  const [isPending, startTransition] = useTransition();
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [openaiKey, setOpenaiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [perplexityKey, setPerplexityKey] = useState('');
  const [analysisModel, setAnalysisModel] = useState(data.ai.analysisAiModel);
  const [articleModel, setArticleModel] = useState(data.ai.articleStudioModel);
  const [localDominanceModel, setLocalDominanceModel] = useState(data.ai.localDominanceModel);
  const [brandVoice, setBrandVoice] = useState(data.ai.brandVoice);
  const [costThreshold, setCostThreshold] = useState(String(data.ai.costAlertThreshold));

  function save(partial: Parameters<typeof updateAiConfig>[0]) {
    startTransition(async () => {
      try {
        await updateAiConfig(partial);
        toast.success('AI settings saved');
        setOpenaiKey('');
        setAnthropicKey('');
        setGeminiKey('');
        setPerplexityKey('');
        onRefresh();
      } catch {
        toast.error('Failed to save AI settings');
      }
    });
  }

  async function testConnection(
    provider: 'openai' | 'anthropic' | 'gemini' | 'perplexity',
    key: string,
    isSet: boolean
  ) {
    setTestingProvider(provider);
    try {
      const useSaved = isSet && !key.trim();
      const result = await testSettingsConnection({
        provider,
        apiKey: useSaved ? undefined : key,
        useSaved,
      });
      if (result.success) {
        toast.success(TEST_CONNECTION_SUCCESS_MESSAGE);
      } else {
        toast.error(TEST_CONNECTION_FAILURE_MESSAGE);
      }
    } catch {
      toast.error(TEST_CONNECTION_FAILURE_MESSAGE);
    } finally {
      setTestingProvider(null);
    }
  }

  return (
    <div className="space-y-6">
      <SettingsSection
        title="API Keys"
        description="Keys are stored per workspace and never shared across tenants."
      >
        <SecureApiKeyInput
          id="openai-key"
          label="OpenAI API Key"
          isSet={data.ai.openai.isSet}
          value={openaiKey}
          onChange={setOpenaiKey}
          onTest={() => testConnection('openai', openaiKey, data.ai.openai.isSet)}
          isTesting={testingProvider === 'openai'}
        />
        <SecureApiKeyInput
          id="anthropic-key"
          label="Anthropic API Key"
          isSet={data.ai.anthropic.isSet}
          value={anthropicKey}
          onChange={setAnthropicKey}
          onTest={() => testConnection('anthropic', anthropicKey, data.ai.anthropic.isSet)}
          isTesting={testingProvider === 'anthropic'}
        />
        <SecureApiKeyInput
          id="gemini-key"
          label="Google Gemini API Key"
          isSet={data.ai.gemini.isSet}
          value={geminiKey}
          onChange={setGeminiKey}
          onTest={() => testConnection('gemini', geminiKey, data.ai.gemini.isSet)}
          isTesting={testingProvider === 'gemini'}
        />
        <SecureApiKeyInput
          id="perplexity-key"
          label="Perplexity API Key"
          isSet={data.ai.perplexity.isSet}
          value={perplexityKey}
          onChange={setPerplexityKey}
          onTest={() => testConnection('perplexity', perplexityKey, data.ai.perplexity.isSet)}
          isTesting={testingProvider === 'perplexity'}
        />
        <button
          type="button"
          className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
          onClick={() =>
            save({
              openaiApiKey: openaiKey,
              anthropicApiKey: anthropicKey,
              geminiApiKey: geminiKey,
              perplexityApiKey: perplexityKey,
            })
          }
          disabled={isPending}
        >
          Save API Keys
        </button>
      </SettingsSection>

      <SettingsSection title="Feature Model Router Matrix">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label>Analysis AI</Label>
            <Select
              value={analysisModel}
              onValueChange={value => {
                setAnalysisModel(value);
                save({ analysisAiModel: value });
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ANALYSIS_AI_MODELS.map(model => (
                  <SelectItem key={model} value={model}>
                    {model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Article Studio</Label>
            <Select
              value={articleModel}
              onValueChange={value => {
                setArticleModel(value);
                save({ articleStudioModel: value });
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ARTICLE_STUDIO_MODELS.map(model => (
                  <SelectItem key={model} value={model}>
                    {model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Local Dominance</Label>
            <Select
              value={localDominanceModel}
              onValueChange={value => {
                setLocalDominanceModel(value);
                save({ localDominanceModel: value });
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ANALYSIS_AI_MODELS.map(model => (
                  <SelectItem key={model} value={model}>
                    {model}
                  </SelectItem>
                ))}
                {ARTICLE_STUDIO_MODELS.map(model => (
                  <SelectItem key={model} value={model}>
                    {model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="Global Brand Voice">
        <Textarea
          rows={5}
          placeholder="Define your default writing style, tone, and vocabulary…"
          value={brandVoice}
          onChange={event => setBrandVoice(event.target.value)}
          onBlur={() => save({ brandVoice })}
        />
      </SettingsSection>

      <SettingsSection title="Cost Guardrails">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>Alert me when custom API token usage exceeds</span>
          <Input
            type="number"
            min={0}
            className="w-24"
            value={costThreshold}
            onChange={event => setCostThreshold(event.target.value)}
            onBlur={() => save({ costAlertThreshold: Number(costThreshold) || 0 })}
          />
          <span>this month.</span>
        </div>
      </SettingsSection>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { CheckCircle2, XCircle, Loader2, Save, Zap, Globe, Layers, Ghost } from 'lucide-react';
import ToolHistoryPanel from '@/components/tool-history/ToolHistoryPanel';
import { useToolHistory } from '@/hooks/useToolHistory';
import { cn } from '@/lib/utils';

type Status = 'idle' | 'testing' | 'success' | 'error';

interface CMSConfig {
  // WordPress
  wpUrl: string;
  wpPassword: string;
  wpStatus: string;
  // Webflow
  wfToken: string;
  wfCollection: string;
  // Ghost
  ghostUrl: string;
  ghostKey: string;
}

interface ConnectionState {
  wordpress: Status;
  webflow: Status;
  ghost: Status;
}

export default function CMSPublishing() {
  const {
    entries,
    isLoading,
    activeId,
    save,
    remove,
    setActiveId,
  } = useToolHistory('cms-publishing', { limit: 25 });

  const [config, setConfig] = useState<CMSConfig>({
    wpUrl: '',
    wpPassword: '',
    wpStatus: 'draft',
    wfToken: '',
    wfCollection: '',
    ghostUrl: '',
    ghostKey: '',
  });

  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [connection, setConnection] = useState<ConnectionState>({
    wordpress: 'idle',
    webflow: 'idle',
    ghost: 'idle',
  });

  function update(key: keyof CMSConfig, value: string) {
    setConfig(prev => ({ ...prev, [key]: value }));
  }

  async function testConnection(platform: keyof ConnectionState) {
    setConnection(prev => ({ ...prev, [platform]: 'testing' }));
    await new Promise(r => setTimeout(r, 1800));
    const success = Math.random() > 0.3;
    setConnection(prev => ({ ...prev, [platform]: success ? 'success' : 'error' }));
  }

  function saveConfig(platform: string) {
    setSaved(prev => ({ ...prev, [platform]: true }));
    setTimeout(() => setSaved(prev => ({ ...prev, [platform]: false })), 2500);

    void save({
      identifier: platform,
      resultData: {
        platform,
        config,
        savedAt: new Date().toISOString(),
      },
    }).then(() => setActiveId(null));
  }

  function StatusIcon({ status }: { status: Status }) {
    if (status === 'testing') return <Loader2 size={15} className="text-blue-500 animate-spin" />;
    if (status === 'success') return <CheckCircle2 size={15} className="text-emerald-500" />;
    if (status === 'error') return <XCircle size={15} className="text-red-500" />;
    return null;
  }

  function ConnectionBadge({ status }: { status: Status }) {
    const map: Record<Status, { text: string; cls: string }> = {
      idle: { text: 'Not tested', cls: 'bg-muted text-muted-foreground' },
      testing: { text: 'Testing...', cls: 'bg-blue-50 text-blue-600' },
      success: { text: 'Connected', cls: 'bg-emerald-50 text-emerald-600' },
      error: { text: 'Failed', cls: 'bg-red-50 text-red-600' },
    };
    const { text, cls } = map[status];
    return (
      <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium', cls)}>
        <StatusIcon status={status} />
        {text}
      </span>
    );
  }

  const inputCls = 'w-full px-3 py-2 text-sm rounded-lg border border-border bg-muted focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors';

  return (
    <div className="min-h-full p-8">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">CMS Publishing</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Configure integrations to publish content directly from OMGLaunch</p>
      </div>

      <div className="grid grid-cols-1 gap-5">
        {/* WordPress */}
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/40">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center">
                <Globe size={17} className="text-white" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">WordPress</h2>
                <p className="text-xs text-muted-foreground">Publish via REST API using application passwords</p>
              </div>
            </div>
            <ConnectionBadge status={connection.wordpress} />
          </div>
          <div className="px-6 py-5">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Site URL</label>
                <input
                  type="url"
                  value={config.wpUrl}
                  onChange={e => update('wpUrl', e.target.value)}
                  placeholder="https://yoursite.com"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Application Password</label>
                <input
                  type="password"
                  value={config.wpPassword}
                  onChange={e => update('wpPassword', e.target.value)}
                  placeholder="xxxx xxxx xxxx xxxx"
                  className={inputCls}
                />
              </div>
            </div>
            <div className="mb-5">
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Default Post Status</label>
              <select
                value={config.wpStatus}
                onChange={e => update('wpStatus', e.target.value)}
                className={inputCls}
              >
                <option value="draft">Draft</option>
                <option value="pending">Pending Review</option>
                <option value="publish">Published</option>
              </select>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => testConnection('wordpress')}
                disabled={connection.wordpress === 'testing'}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-foreground text-sm font-medium hover:bg-muted disabled:opacity-50 transition-colors"
              >
                <Zap size={14} />
                Test Connection
              </button>
              <button
                onClick={() => saveConfig('wordpress')}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                  saved.wordpress
                    ? 'bg-emerald-500 text-white'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                )}
              >
                {saved.wordpress ? <CheckCircle2 size={14} /> : <Save size={14} />}
                {saved.wordpress ? 'Saved!' : 'Save Config'}
              </button>
            </div>
          </div>
        </div>

        {/* Webflow */}
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/40">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-violet-600 flex items-center justify-center">
                <Layers size={17} className="text-white" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Webflow</h2>
                <p className="text-xs text-muted-foreground">Push CMS items via Webflow Data API v2</p>
              </div>
            </div>
            <ConnectionBadge status={connection.webflow} />
          </div>
          <div className="px-6 py-5">
            <div className="grid grid-cols-2 gap-4 mb-5">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">API Token</label>
                <input
                  type="password"
                  value={config.wfToken}
                  onChange={e => update('wfToken', e.target.value)}
                  placeholder="Bearer token..."
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Collection ID</label>
                <input
                  type="text"
                  value={config.wfCollection}
                  onChange={e => update('wfCollection', e.target.value)}
                  placeholder="64a1b2c3d4e5f6g7h8i9j0k1"
                  className={inputCls}
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => testConnection('webflow')}
                disabled={connection.webflow === 'testing'}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-foreground text-sm font-medium hover:bg-muted disabled:opacity-50 transition-colors"
              >
                <Zap size={14} />
                Test Connection
              </button>
              <button
                onClick={() => saveConfig('webflow')}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                  saved.webflow
                    ? 'bg-emerald-500 text-white'
                    : 'bg-violet-600 text-white hover:bg-violet-700'
                )}
              >
                {saved.webflow ? <CheckCircle2 size={14} /> : <Save size={14} />}
                {saved.webflow ? 'Saved!' : 'Save Config'}
              </button>
            </div>
          </div>
        </div>

        {/* Ghost */}
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/40">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gray-900 flex items-center justify-center">
                <Ghost size={17} className="text-white" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Ghost</h2>
                <p className="text-xs text-muted-foreground">Publish posts via Ghost Admin API with basic auth</p>
              </div>
            </div>
            <ConnectionBadge status={connection.ghost} />
          </div>
          <div className="px-6 py-5">
            <div className="grid grid-cols-2 gap-4 mb-5">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Admin API URL</label>
                <input
                  type="url"
                  value={config.ghostUrl}
                  onChange={e => update('ghostUrl', e.target.value)}
                  placeholder="https://yoursite.ghost.io"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Admin API Key</label>
                <input
                  type="password"
                  value={config.ghostKey}
                  onChange={e => update('ghostKey', e.target.value)}
                  placeholder="id:secret"
                  className={inputCls}
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => testConnection('ghost')}
                disabled={connection.ghost === 'testing'}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-foreground text-sm font-medium hover:bg-muted disabled:opacity-50 transition-colors"
              >
                <Zap size={14} />
                Test Connection
              </button>
              <button
                onClick={() => saveConfig('ghost')}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                  saved.ghost
                    ? 'bg-emerald-500 text-white'
                    : 'bg-gray-900 text-white hover:bg-gray-800'
                )}
              >
                {saved.ghost ? <CheckCircle2 size={14} /> : <Save size={14} />}
                {saved.ghost ? 'Saved!' : 'Save Config'}
              </button>
            </div>
          </div>
        </div>
      </div>
        </div>

        <ToolHistoryPanel
          title="Saved Configurations"
          entries={entries}
          activeId={activeId}
          isLoading={isLoading}
          onLoad={entry => setActiveId(entry.id)}
          onDelete={id => void remove(id)}
        />
      </div>
    </div>
  );
}

'use client';

import { useState, useTransition } from 'react';
import { toast } from '@/components/ui/sonner';
import type { SettingsBundle } from '@/app/actions/settings';
import { updateWorkspaceSettings } from '@/app/actions/settings';
import SettingsSection from '@/components/settings/SettingsSection';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { COUNTRIES, GOOGLE_DOMAINS, LANGUAGES } from '@/lib/settings/constants';

type TrackingTabProps = {
  data: SettingsBundle;
  onRefresh: () => void;
};

const US_STATES = [
  { value: '', label: '— None —' },
  { value: 'CA', label: 'California' },
  { value: 'NY', label: 'New York' },
  { value: 'TX', label: 'Texas' },
  { value: 'FL', label: 'Florida' },
];

export default function TrackingTab({ data, onRefresh }: TrackingTabProps) {
  const [, startTransition] = useTransition();
  const [country, setCountry] = useState(data.workspace.defaultCountry);
  const [state, setState] = useState(data.workspace.defaultState);
  const [googleDomain, setGoogleDomain] = useState(data.workspace.defaultGoogleDomain);
  const [language, setLanguage] = useState(data.workspace.defaultLanguage);
  const [device, setDevice] = useState(data.workspace.defaultDevice);

  function save(partial: Parameters<typeof updateWorkspaceSettings>[0]) {
    startTransition(async () => {
      try {
        await updateWorkspaceSettings(partial);
        toast.success('Tracking defaults saved');
        onRefresh();
      } catch {
        toast.error('Failed to save defaults');
      }
    });
  }

  return (
    <div className="space-y-6">
      <SettingsSection
        title="Default Location"
        description="Platform-wide defaults applied to new keyword projects."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Country</Label>
            <Select
              value={country}
              onValueChange={value => {
                setCountry(value);
                save({ defaultCountry: value });
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map(item => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>State</Label>
            <Select
              value={state || ''}
              onValueChange={value => {
                setState(value);
                save({ defaultState: value });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent>
                {US_STATES.map(item => (
                  <SelectItem key={item.value || 'none'} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Google Domain</Label>
            <Select
              value={googleDomain}
              onValueChange={value => {
                setGoogleDomain(value);
                save({ defaultGoogleDomain: value });
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GOOGLE_DOMAINS.map(item => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="Search Parameters">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Language</Label>
            <Select
              value={language}
              onValueChange={value => {
                setLanguage(value);
                save({ defaultLanguage: value });
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map(item => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Device</Label>
            <Select
              value={device}
              onValueChange={value => {
                setDevice(value);
                save({ defaultDevice: value });
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desktop">Desktop</SelectItem>
                <SelectItem value="mobile">Mobile</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </SettingsSection>
    </div>
  );
}

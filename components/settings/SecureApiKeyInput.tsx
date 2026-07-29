'use client';

import { useState } from 'react';
import { Check, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type SecureApiKeyInputProps = {
  id: string;
  label: string;
  isSet: boolean;
  value: string;
  onChange: (value: string) => void;
  onTest?: () => void | Promise<void>;
  testLabel?: string;
  isTesting?: boolean;
};

export default function SecureApiKeyInput({
  id,
  label,
  isSet,
  value,
  onChange,
  onTest,
  testLabel = 'Test Connection',
  isTesting = false,
}: SecureApiKeyInputProps) {
  const [revealed, setRevealed] = useState(false);
  const displayValue = !revealed && isSet && !value ? '••••••••' : value;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {isSet ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
            <Check className="h-3.5 w-3.5" />
            Saved
          </span>
        ) : null}
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            id={id}
            type={revealed ? 'text' : 'password'}
            value={displayValue}
            placeholder={isSet ? '••••••••' : 'Enter API key'}
            onChange={event => onChange(event.target.value)}
            onFocus={() => {
              if (isSet && value === '' && !revealed) {
                onChange('');
              }
            }}
            className={cn(isSet && 'border-emerald-200 dark:border-emerald-900/50')}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
            onClick={() => setRevealed(prev => !prev)}
            aria-label={revealed ? 'Hide key' : 'Reveal key'}
          >
            {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
        {onTest ? (
          <Button type="button" variant="outline" onClick={onTest} disabled={isTesting}>
            {isTesting ? 'Testing…' : testLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

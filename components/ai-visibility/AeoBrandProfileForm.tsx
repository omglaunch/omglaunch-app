'use client';

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
import {
  DEFAULT_ENTITY_TYPE,
  ENTITY_TYPE_OPTIONS,
  type EntityType,
} from '@/lib/ai-visibility/entity-type';
import { entityTypeRequiresNap } from '@/lib/domain-profile/entity-publish-requirements';

export type AeoBrandProfileFormValues = {
  brandLabel: string;
  primaryUrl: string;
  extraAliases: string;
  entityType: EntityType;
  contactPhone: string;
  contactEmail: string;
  address: string;
  sameAsUrls: string;
};

export const EMPTY_AEO_BRAND_FORM: AeoBrandProfileFormValues = {
  brandLabel: '',
  primaryUrl: '',
  extraAliases: '',
  entityType: DEFAULT_ENTITY_TYPE,
  contactPhone: '',
  contactEmail: '',
  address: '',
  sameAsUrls: '',
};

type Props = {
  values: AeoBrandProfileFormValues;
  onChange: (patch: Partial<AeoBrandProfileFormValues>) => void;
  idPrefix?: string;
  disabled?: boolean;
  /** Project.domain — shown as URL match guidance for primaryUrl. */
  projectDomain?: string | null;
};

export default function AeoBrandProfileForm({
  values,
  onChange,
  idPrefix = 'aeo-brand',
  disabled = false,
  projectDomain = null,
}: Props) {
  const normalizedProjectDomain = projectDomain?.trim() || null;
  const napRequired = entityTypeRequiresNap(values.entityType);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-label`}>Brand display name</Label>
        <Input
          id={`${idPrefix}-label`}
          value={values.brandLabel}
          onChange={e => onChange({ brandLabel: e.target.value })}
          placeholder="e.g. Seattle HVAC Pros"
          required
          disabled={disabled}
        />
        <p className="text-xs text-muted-foreground">
          Your client&apos;s public brand name — not your agency workspace name. Used in reports,
          exports, and the domain manifest entity profile.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-url`}>Primary website URL</Label>
        <Input
          id={`${idPrefix}-url`}
          value={values.primaryUrl}
          onChange={e => onChange({ primaryUrl: e.target.value })}
          placeholder="e.g. https://seattlehvacpros.com"
          required
          disabled={disabled}
        />
        <p className="text-xs text-muted-foreground">
          Must match the client&apos;s website
          {normalizedProjectDomain ? (
            <>
              {' '}
              (<code className="text-[11px]">{normalizedProjectDomain}</code>)
            </>
          ) : (
            ' domain'
          )}
          . Mismatched URLs break citation matching and manifest validation.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-entity-type`}>Entity type</Label>
        <Select
          value={values.entityType}
          onValueChange={value => onChange({ entityType: value as EntityType })}
          disabled={disabled}
        >
          <SelectTrigger id={`${idPrefix}-entity-type`}>
            <SelectValue placeholder="Select entity type" />
          </SelectTrigger>
          <SelectContent>
            {ENTITY_TYPE_OPTIONS.map(option => (
              <SelectItem key={option.value} value={option.value}>
                <span className="font-medium">{option.label}</span>
                <span className="ml-2 text-muted-foreground">— {option.description}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Schema.org type for your domain manifest JSON-LD. Local businesses should choose
          Local Business; most B2B brands use Organization.
        </p>
      </div>

      <div className="space-y-3 border-t border-border pt-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            NAP {napRequired ? '(required for this entity type)' : '(optional)'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Name comes from the brand display name above. Phone, email, and address feed the
            domain manifest for local SEO and entity consistency.
            {napRequired
              ? ' Local Business and Medical Organization profiles require phone and address before manifest publish.'
              : null}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-phone`}>
              Phone{napRequired ? ' *' : ''}
            </Label>
            <Input
              id={`${idPrefix}-phone`}
              value={values.contactPhone}
              onChange={e => onChange({ contactPhone: e.target.value })}
              placeholder="e.g. (206) 555-0100"
              disabled={disabled}
              required={napRequired}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-email`}>Contact email</Label>
            <Input
              id={`${idPrefix}-email`}
              type="email"
              value={values.contactEmail}
              onChange={e => onChange({ contactEmail: e.target.value })}
              placeholder="e.g. hello@client.com"
              disabled={disabled}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-address`}>
            Address{napRequired ? ' *' : ''}
          </Label>
          <Textarea
            id={`${idPrefix}-address`}
            value={values.address}
            onChange={e => onChange({ address: e.target.value })}
            placeholder="Street, city, state/province, postal code"
            rows={2}
            disabled={disabled}
            required={napRequired}
          />
          <p className="text-xs text-muted-foreground">
            Use comma-separated format for best Schema.org parsing (e.g. 123 Main St, Seattle, WA
            98101).
          </p>
        </div>
      </div>

      <div className="space-y-2 border-t border-border pt-4">
        <Label htmlFor={`${idPrefix}-sameas`}>Profile URLs (sameAs)</Label>
        <Textarea
          id={`${idPrefix}-sameas`}
          value={values.sameAsUrls}
          onChange={e => onChange({ sameAsUrls: e.target.value })}
          placeholder={'Google Business Profile, LinkedIn, Facebook, Wikidata…\nOne URL per line'}
          rows={3}
          disabled={disabled}
        />
        <p className="text-xs text-muted-foreground">
          Authoritative profiles that confirm this entity. Included as Schema.org{' '}
          <code className="text-[11px]">sameAs</code> in the domain manifest.
        </p>
      </div>

      <div className="space-y-2 border-t border-border pt-4">
        <Label htmlFor={`${idPrefix}-aliases`}>Extra aliases (optional)</Label>
        <Textarea
          id={`${idPrefix}-aliases`}
          value={values.extraAliases}
          onChange={e => onChange({ extraAliases: e.target.value })}
          placeholder="One per line or comma-separated"
          rows={3}
          disabled={disabled}
        />
        <p className="text-xs text-muted-foreground">
          Domain and brand name aliases are added automatically from the fields above.
        </p>
      </div>
    </div>
  );
}

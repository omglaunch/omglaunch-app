'use client';

import { useState } from 'react';
import { Factory, Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SERVICE_AREA_CREDIT_COST_PER_CITY } from '@/lib/local-dominance/constants';

const cardSurface =
  'border-zinc-200 bg-white dark:border-slate-800 dark:bg-slate-900/50';
const inputSurface =
  'border-zinc-300 bg-white text-zinc-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';
const labelMuted = 'text-zinc-600 dark:text-slate-300';
const titleText = 'text-zinc-900 dark:text-slate-100';
const primaryCta =
  'bg-emerald-600 text-white hover:bg-emerald-500 dark:bg-blue-600 dark:hover:bg-blue-500';

export default function ServiceAreaFactoryTab() {
  const [coreService, setCoreService] = useState('');
  const [targetCities, setTargetCities] = useState('');
  const [clientCid, setClientCid] = useState('');
  const [centralGps, setCentralGps] = useState('');
  const [isQueuing, setIsQueuing] = useState(false);
  const [queuedJobs, setQueuedJobs] = useState<string[]>([]);

  async function queueGeneration() {
    const cities = targetCities
      .split('\n')
      .map(c => c.trim())
      .filter(Boolean);

    if (!coreService.trim() || cities.length === 0) {
      toast.error('Enter a core service and at least one target city');
      return;
    }

    let centralLat: number | undefined;
    let centralLng: number | undefined;
    if (centralGps.trim()) {
      const parts = centralGps.split(',').map(p => p.trim());
      if (parts.length === 2) {
        centralLat = Number(parts[0]);
        centralLng = Number(parts[1]);
      }
    }

    setIsQueuing(true);
    try {
      const response = await fetch('/api/local-dominance/service-area/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coreService: coreService.trim(),
          targetCities: cities,
          clientCid: clientCid.trim() || undefined,
          centralLat,
          centralLng,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error ?? 'Failed to queue generation');
        return;
      }

      setQueuedJobs(data.jobIds ?? []);
      toast.success(`Queued ${data.queued} city page(s) for background generation`);
    } catch {
      toast.error('Failed to queue generation');
    } finally {
      setIsQueuing(false);
    }
  }

  const cityCount = targetCities.split('\n').filter(c => c.trim()).length;

  return (
    <div className="space-y-6">
      <Card className={cardSurface}>
        <CardHeader>
          <CardTitle className={`flex items-center gap-2 ${titleText}`}>
            <Factory className="h-5 w-5 text-emerald-600 dark:text-purple-400" />
            Service Area Factory
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label className={labelMuted}>Core Service</Label>
            <Input
              value={coreService}
              onChange={e => setCoreService(e.target.value)}
              placeholder="Emergency Plumbing"
              className={inputSurface}
            />
          </div>
          <div className="space-y-2">
            <Label className={labelMuted}>Client Google CID</Label>
            <Input
              value={clientCid}
              onChange={e => setClientCid(e.target.value)}
              placeholder="ChIJ..."
              className={inputSurface}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label className={labelMuted}>Target Cities (one per line)</Label>
            <Textarea
              value={targetCities}
              onChange={e => setTargetCities(e.target.value)}
              placeholder={'Austin, TX\nDallas, TX\nHouston, TX'}
              rows={5}
              className={inputSurface}
            />
            {cityCount > 0 && (
              <p className="text-xs text-zinc-500 dark:text-slate-500">
                {cityCount} cities × {SERVICE_AREA_CREDIT_COST_PER_CITY} credits ={' '}
                {cityCount * SERVICE_AREA_CREDIT_COST_PER_CITY} credits
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label className={labelMuted}>Central GPS for EXIF (lat,lng)</Label>
            <Input
              value={centralGps}
              onChange={e => setCentralGps(e.target.value)}
              placeholder="30.2672,-97.7431"
              className={inputSurface}
            />
          </div>
          <div className="flex items-end">
            <Button onClick={queueGeneration} disabled={isQueuing} className={`w-full ${primaryCta}`}>
              {isQueuing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Queuing…
                </>
              ) : (
                'Generate & Publish (Background Queue)'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {queuedJobs.length > 0 && (
        <Card className={cardSurface}>
          <CardHeader>
            <CardTitle className={titleText}>Queued Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm text-zinc-500 dark:text-slate-400">
              {queuedJobs.map(id => (
                <li key={id} className="font-mono text-xs">
                  {id} — processing asynchronously
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-zinc-500 dark:text-slate-500">
              Pages are generated via LLM, EXIF geo-tagged, published to WordPress with separate
              JSON-LD meta, and posted to GBP.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

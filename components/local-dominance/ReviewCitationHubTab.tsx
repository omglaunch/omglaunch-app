'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, MessageSquare, QrCode, Search } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { buildGoogleReviewShortLink } from '@/lib/local-dominance/review-link';

type Review = {
  id: string;
  text: string;
  rating: number;
  reviewer: string;
  createTime: string;
};

const cardSurface =
  'border-zinc-200 bg-white dark:border-slate-800 dark:bg-slate-900/50';
const inputSurface =
  'border-zinc-300 bg-white text-zinc-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';
const labelMuted = 'text-zinc-600 dark:text-slate-300';
const titleText = 'text-zinc-900 dark:text-slate-100';
const mutedText = 'text-zinc-500 dark:text-slate-400';
const primaryCta =
  'bg-emerald-600 text-white hover:bg-emerald-500 dark:bg-blue-600 dark:hover:bg-blue-500';

export default function ReviewCitationHubTab() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [generatedReply, setGeneratedReply] = useState('');
  const [generatingReply, setGeneratingReply] = useState(false);
  const [placeId, setPlaceId] = useState('');
  const [brandName, setBrandName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [citationResult, setCitationResult] = useState<{
    citationsFound: number;
    consistent: number;
    inconsistent: number;
    entries: Array<{ source: string; url: string; napMatch: string; details: string }>;
  } | null>(null);
  const [auditing, setAuditing] = useState(false);

  const loadReviews = useCallback(async () => {
    setLoadingReviews(true);
    try {
      const response = await fetch('/api/local-dominance/reviews');
      const data = await response.json();
      setReviews(data.reviews ?? []);
    } catch {
      toast.error('Failed to load reviews');
    } finally {
      setLoadingReviews(false);
    }
  }, []);

  useEffect(() => {
    void loadReviews();
  }, [loadReviews]);

  async function generateReply() {
    if (!selectedReview) return;
    setGeneratingReply(true);
    try {
      const response = await fetch('/api/local-dominance/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewText: selectedReview.text,
          rating: selectedReview.rating,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error ?? 'Failed to generate reply');
        return;
      }
      setGeneratedReply(data.reply ?? '');
    } catch {
      toast.error('Failed to generate reply');
    } finally {
      setGeneratingReply(false);
    }
  }

  async function runCitationAudit() {
    if (!brandName.trim() || !address.trim() || !phone.trim()) {
      toast.error('Brand name, address, and phone are required');
      return;
    }

    setAuditing(true);
    try {
      const response = await fetch('/api/local-dominance/citation/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandName, address, phone }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error ?? 'Citation audit failed');
        return;
      }
      setCitationResult(data);
      toast.success('Citation audit complete');
    } catch {
      toast.error('Citation audit failed');
    } finally {
      setAuditing(false);
    }
  }

  const reviewLink = placeId.trim() ? buildGoogleReviewShortLink(placeId.trim()) : '';

  return (
    <div className="space-y-6">
      <Card className={cardSurface}>
        <CardHeader>
          <CardTitle className={`flex items-center gap-2 ${titleText}`}>
            <MessageSquare className="h-5 w-5 text-emerald-600 dark:text-green-400" />
            AI Review Responder
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingReviews ? (
            <div className={`flex items-center gap-2 ${mutedText}`}>
              <Loader2 className="h-4 w-4 animate-spin" /> Loading reviews…
            </div>
          ) : reviews.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-slate-500">
              No reviews found. Connect Google Business Profile in Settings → Integrations.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {reviews.map(review => (
                  <button
                    key={review.id}
                    type="button"
                    onClick={() => {
                      setSelectedReview(review);
                      setGeneratedReply('');
                    }}
                    className={`w-full rounded-md border p-3 text-left text-sm transition-colors ${
                      selectedReview?.id === review.id
                        ? 'border-emerald-300 bg-emerald-50 dark:border-blue-600 dark:bg-blue-950/30'
                        : 'border-zinc-200 bg-zinc-50 hover:bg-zinc-100 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-zinc-800 dark:text-slate-200">
                        {review.reviewer}
                      </span>
                      <span className="text-yellow-600 dark:text-yellow-400">{review.rating}★</span>
                    </div>
                    <p className={`mt-1 line-clamp-2 ${mutedText}`}>{review.text}</p>
                  </button>
                ))}
              </div>
              <div className="space-y-3">
                {selectedReview && (
                  <>
                    <p className="text-sm text-zinc-700 dark:text-slate-300">{selectedReview.text}</p>
                    <Button
                      onClick={generateReply}
                      disabled={generatingReply}
                      size="sm"
                      className={primaryCta}
                    >
                      {generatingReply ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Generate AI Reply
                    </Button>
                    {generatedReply && (
                      <Textarea
                        value={generatedReply}
                        onChange={e => setGeneratedReply(e.target.value)}
                        rows={4}
                        className={inputSurface}
                      />
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className={cardSurface}>
        <CardHeader>
          <CardTitle className={`flex items-center gap-2 ${titleText}`}>
            <QrCode className="h-5 w-5 text-emerald-600 dark:text-blue-400" />
            Reputation Accelerator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className={labelMuted}>Google Place ID</Label>
            <Input
              value={placeId}
              onChange={e => setPlaceId(e.target.value)}
              placeholder="ChIJ..."
              className={inputSurface}
            />
          </div>
          {reviewLink && (
            <div className="flex flex-wrap items-start gap-6">
              <div className="space-y-2">
                <p className={`text-sm ${mutedText}`}>Official Review Short Link</p>
                <a
                  href={reviewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all text-sm text-emerald-600 hover:underline dark:text-blue-400"
                >
                  {reviewLink}
                </a>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-slate-700">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 100 100"
                  className="h-24 w-24"
                >
                  <rect width="100" height="100" fill="white" />
                  <text x="50" y="55" textAnchor="middle" fontSize="8" fill="#1e293b">
                    Scan to Review
                  </text>
                  {/* Minimal QR placeholder — production would use qrcode library */}
                  {Array.from({ length: 8 }).map((_, row) =>
                    Array.from({ length: 8 }).map((_, col) => (
                      <rect
                        key={`${row}-${col}`}
                        x={20 + col * 8}
                        y={20 + row * 8}
                        width={6}
                        height={6}
                        fill={(row + col) % 2 === 0 ? '#1e293b' : 'white'}
                      />
                    ))
                  )}
                </svg>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className={cardSurface}>
        <CardHeader>
          <CardTitle className={`flex items-center gap-2 ${titleText}`}>
            <Search className="h-5 w-5 text-emerald-600 dark:text-orange-400" />
            NAP Citation Audit
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label className={labelMuted}>Brand Name</Label>
            <Input
              value={brandName}
              onChange={e => setBrandName(e.target.value)}
              className={inputSurface}
            />
          </div>
          <div className="space-y-2">
            <Label className={labelMuted}>Address</Label>
            <Input
              value={address}
              onChange={e => setAddress(e.target.value)}
              className={inputSurface}
            />
          </div>
          <div className="space-y-2">
            <Label className={labelMuted}>Phone</Label>
            <Input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className={inputSurface}
            />
          </div>
          <div className="md:col-span-3">
            <Button onClick={runCitationAudit} disabled={auditing} className={primaryCta}>
              {auditing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Run Citation Audit
            </Button>
          </div>
          {citationResult && (
            <div className="space-y-3 md:col-span-3">
              <div className="flex gap-4 text-sm">
                <span className={mutedText}>Found: {citationResult.citationsFound}</span>
                <span className="text-emerald-600 dark:text-emerald-400">
                  Consistent: {citationResult.consistent}
                </span>
                <span className="text-red-600 dark:text-red-400">
                  Inconsistent: {citationResult.inconsistent}
                </span>
              </div>
              <ul className="space-y-2">
                {citationResult.entries.map(entry => (
                  <li
                    key={entry.url}
                    className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/50"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-zinc-800 dark:text-slate-200">
                        {entry.source}
                      </span>
                      <span
                        className={`text-xs ${
                          entry.napMatch === 'consistent'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : entry.napMatch === 'inconsistent'
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-yellow-600 dark:text-yellow-400'
                        }`}
                      >
                        {entry.napMatch}
                      </span>
                    </div>
                    <a
                      href={entry.url}
                      className="text-xs text-emerald-600 hover:underline dark:text-blue-400"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {entry.url}
                    </a>
                    <p className={`mt-1 ${mutedText}`}>{entry.details}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

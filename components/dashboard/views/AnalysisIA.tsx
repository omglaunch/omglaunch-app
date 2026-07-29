'use client';

import { Download, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Parameter {
  label: string;
  value: number;
  color: 'green' | 'orange' | 'red' | 'gray';
}

const PARAMETERS: Parameter[] = [
  { label: 'Is the page well structured?', value: 90, color: 'green' },
  { label: 'Does the page include descriptive images?', value: 85, color: 'green' },
  { label: 'Does the page have valid JSON-LD?', value: 88, color: 'green' },
  { label: 'Is the page well segmented?', value: 90, color: 'green' },
  { label: 'Is the content easy to read?', value: 85, color: 'green' },
  { label: 'Is the markup semantically consistent?', value: 65, color: 'orange' },
  { label: 'Does the page have a table of contents?', value: 0, color: 'gray' },
  { label: 'Does the page offer a concise summary?', value: 72, color: 'orange' },
  { label: 'Does the page load quickly?', value: 52, color: 'red' },
  { label: 'Is the content accessible without JavaScript?', value: 100, color: 'green' },
  { label: 'Is the robots.txt file complete?', value: 95, color: 'green' },
];

function colorClass(color: Parameter['color']) {
  switch (color) {
    case 'green': return 'bg-emerald-500';
    case 'orange': return 'bg-amber-400';
    case 'red': return 'bg-red-500';
    case 'gray': return 'bg-gray-200';
  }
}

function textColorClass(color: Parameter['color']) {
  switch (color) {
    case 'green': return 'text-emerald-600';
    case 'orange': return 'text-amber-600';
    case 'red': return 'text-red-600';
    case 'gray': return 'text-muted-foreground';
  }
}

function ScoreGauge({ score }: { score: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center w-36 h-36">
      <svg width="144" height="144" viewBox="0 0 144 144" className="-rotate-90">
        <circle
          cx="72"
          cy="72"
          r={radius}
          fill="none"
          stroke="#f3f4f6"
          strokeWidth="10"
        />
        <circle
          cx="72"
          cy="72"
          r={radius}
          fill="none"
          stroke="#f59e0b"
          strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-foreground">78.2</span>
        <span className="text-sm font-medium text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}

export default function AnalysisIA() {
  return (
    <div className="min-h-full p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Analysis AI</h1>
          <p className="text-sm text-muted-foreground mt-0.5">AI-readiness evaluation for your page</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-50 text-blue-700 text-sm font-medium border border-blue-200 hover:bg-blue-100 transition-colors">
            <Download size={15} />
            Download the PDF
          </button>
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm">
            <RefreshCw size={15} />
            Relaunch the analysis
          </button>
        </div>
      </div>

      {/* Main Card */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        {/* Card Header */}
        <div className="px-6 py-4 border-b border-border bg-muted/60">
          <h2 className="text-sm font-semibold text-foreground">
            Analysis AI Ready of{' '}
            <span className="text-blue-600 font-mono">https://example.com/target-page</span>
          </h2>
        </div>

        {/* Card Body — Two Column Grid */}
        <div className="grid grid-cols-3 divide-x divide-border">
          {/* Left Column — GEO Score */}
          <div className="p-6 flex flex-col items-center gap-4">
            <div className="w-full rounded-xl border border-border bg-muted/40 p-5 flex flex-col items-center gap-4">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                GEO score of the page
              </h3>
              <ScoreGauge score={78.2} />

              {/* Progress bar */}
              <div className="w-full">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs text-muted-foreground">Score</span>
                  <span className="text-sm font-bold text-amber-500">78.2%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-700"
                    style={{ width: '78.2%' }}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2 text-center px-1">
              <p className="text-sm font-semibold text-foreground leading-snug">
                This page is well optimized for AI, with a few minor areas for improvement.
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                The main areas for improvement are the table of contents and loading performance.
              </p>
            </div>
          </div>

          {/* Right Column — Parameters */}
          <div className="col-span-2 p-6">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-5">
              AI-Readiness Parameters
            </h3>
            <div className="space-y-3.5">
              {PARAMETERS.map((param, i) => (
                <div key={i} className="group">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-foreground pr-4">{param.label}</span>
                    <span className={cn('text-sm font-semibold tabular-nums shrink-0', textColorClass(param.color))}>
                      {param.value}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-500', colorClass(param.color))}
                      style={{ width: `${param.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="mt-6 flex items-center gap-5 pt-4 border-t border-border">
              {[
                { color: 'bg-emerald-500', label: 'Good (≥ 80%)' },
                { color: 'bg-amber-400', label: 'Moderate (50-79%)' },
                { color: 'bg-red-500', label: 'Poor (< 50%)' },
                { color: 'bg-gray-200', label: 'Not detected' },
              ].map(leg => (
                <div key={leg.label} className="flex items-center gap-1.5">
                  <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', leg.color)} />
                  <span className="text-xs text-muted-foreground">{leg.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

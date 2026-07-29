'use client';

import { useState, useRef } from 'react';
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Heading2,
  Link,
  Sparkles,
  CheckCircle2,
  Circle,
  AlignLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from 'recharts';
import ToolHistoryPanel from '@/components/tool-history/ToolHistoryPanel';
import { useToolHistory } from '@/hooks/useToolHistory';

const ENTITIES = [
  { label: 'Schema markup', keyword: 'schema' },
  { label: 'Semantic HTML5 tags', keyword: 'article' },
  { label: 'Alt text for images', keyword: 'alt text' },
  { label: 'Internal linking strategy', keyword: 'internal link' },
  { label: 'Long-form content (>1000 words)', keyword: 'comprehensive' },
  { label: 'LSI keywords present', keyword: 'semantic' },
  { label: 'FAQ section included', keyword: 'faq' },
  { label: 'Author bio or E-E-A-T signals', keyword: 'author' },
];

const INITIAL_CONTENT = `# How AI is Transforming Modern SEO Strategies

Search engine optimization has undergone a fundamental shift with the rise of artificial intelligence. Today, ranking well means more than placing keywords — it requires semantic relevance, authoritative structure, and content that answers user intent comprehensively.

## Understanding AI-Powered Search

Modern search engines use large language models to understand context, entities, and relationships between concepts. A well-structured article with clear semantic HTML5 tags and schema markup signals credibility to both crawlers and users.

## Building E-E-A-T Into Your Content

Include an author bio with credentials to demonstrate Experience, Expertise, Authoritativeness, and Trustworthiness. This is especially important in YMYL (Your Money Your Life) niches.

`;

export default function AIContentWriter() {
  const [content, setContent] = useState(INITIAL_CONTENT);
  const [aiPrompt, setAiPrompt] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const {
    entries,
    isLoading,
    activeId,
    save,
    remove,
    loadEntry,
    setActiveId,
  } = useToolHistory('ai-content-writer', { limit: 25 });

  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
  const charCount = content.length;

  const detectedEntities = ENTITIES.filter(e =>
    content.toLowerCase().includes(e.keyword.toLowerCase())
  );
  const entityScore = Math.round((detectedEntities.length / ENTITIES.length) * 100);

  const onPageStrength = Math.min(100, Math.round(
    (wordCount / 1000) * 20 +
    entityScore * 0.6 +
    (content.includes('#') ? 10 : 0) +
    (content.includes('##') ? 10 : 0)
  ));

  const gaugeData = [{ name: 'strength', value: onPageStrength, fill: onPageStrength >= 70 ? '#10b981' : onPageStrength >= 40 ? '#f59e0b' : '#ef4444' }];

  function insertFormat(prefix: string, suffix = '') {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = content.slice(start, end);
    const newContent = content.slice(0, start) + prefix + selected + suffix + content.slice(end);
    setContent(newContent);
    setTimeout(() => {
      ta.selectionStart = start + prefix.length;
      ta.selectionEnd = end + prefix.length;
      ta.focus();
    }, 0);
  }

  function handleAiGenerate() {
    if (!aiPrompt.trim()) return;
    setContent(prev => prev + `\n\n## ${aiPrompt}\n\nAI-generated content for "${aiPrompt}" will appear here. This section covers the semantic, technical, and strategic aspects of the topic with schema markup integration.\n`);
    setAiPrompt('');
  }

  async function saveDraftToHistory() {
    const titleLine = content.split('\n').find(line => line.startsWith('#')) ?? 'Untitled draft';
    const identifier = titleLine.replace(/^#+\s*/, '').trim() || 'Untitled draft';
    await save({
      identifier,
      resultData: {
        content,
        wordCount,
        charCount,
        onPageStrength,
        entityScore,
        savedAt: new Date().toISOString(),
      },
    });
  }

  return (
    <div className="min-h-full p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
        <h1 className="text-xl font-semibold text-foreground">AI Content Writer</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Create SEO-optimized content with real-time scoring</p>
        </div>
        <button
          type="button"
          onClick={() => void saveDraftToHistory()}
          className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
        >
          Save to History
        </button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0">
      <div className="flex gap-5 h-[calc(100vh-160px)]">
        {/* Left Pane — Editor */}
        <div className="flex-[3] flex flex-col bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center gap-1 px-4 py-2.5 border-b border-border bg-muted/60 flex-wrap">
            <span className="text-xs text-muted-foreground font-medium mr-2">Format</span>
            {[
              { icon: Bold, action: () => insertFormat('**', '**'), title: 'Bold' },
              { icon: Italic, action: () => insertFormat('_', '_'), title: 'Italic' },
              { icon: Underline, action: () => insertFormat('<u>', '</u>'), title: 'Underline' },
              { icon: Heading2, action: () => insertFormat('\n## ', '\n'), title: 'Heading 2' },
              { icon: List, action: () => insertFormat('\n- '), title: 'Bullet List' },
              { icon: ListOrdered, action: () => insertFormat('\n1. '), title: 'Numbered List' },
              { icon: Link, action: () => insertFormat('[', '](url)'), title: 'Link' },
              { icon: AlignLeft, action: () => {}, title: 'Paragraph' },
            ].map(({ icon: Icon, action, title }) => (
              <button
                key={title}
                onClick={action}
                title={title}
                className="p-1.5 rounded hover:bg-gray-200 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Icon size={14} />
              </button>
            ))}
            <div className="ml-auto flex items-center gap-3">
              <span className="text-xs text-muted-foreground">{wordCount} words</span>
              <span className="text-xs text-gray-300">|</span>
              <span className="text-xs text-muted-foreground">{charCount} chars</span>
            </div>
          </div>

          {/* Text area */}
          <textarea
            ref={textareaRef}
            value={content}
            onChange={e => setContent(e.target.value)}
            className="flex-1 p-5 resize-none text-sm text-foreground leading-relaxed font-mono focus:outline-none placeholder:text-gray-300"
            placeholder="Start writing your SEO-optimized content here..."
            spellCheck={true}
          />

          {/* AI Generate bar */}
          <div className="px-4 py-3 border-t border-border bg-gradient-to-r from-blue-50 to-blue-50/30">
            <div className="flex items-center gap-3">
              <Sparkles size={15} className="text-blue-500 shrink-0" />
              <input
                type="text"
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAiGenerate()}
                placeholder="Describe a section to generate with AI..."
                className="flex-1 text-sm bg-transparent border-none focus:outline-none text-foreground placeholder:text-muted-foreground"
              />
              <button
                onClick={handleAiGenerate}
                disabled={!aiPrompt.trim()}
                className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Generate
              </button>
            </div>
          </div>
        </div>

        {/* Right Pane — SEO Grading */}
        <div className="flex-[2] flex flex-col gap-4 overflow-y-auto">
          {/* Gauge card */}
          <div className="bg-card rounded-xl border border-border shadow-sm p-5">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">On-Page Strength</h3>
            <div className="flex items-center gap-4">
              <div className="w-28 h-28 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart
                    innerRadius="65%"
                    outerRadius="100%"
                    data={gaugeData}
                    startAngle={180}
                    endAngle={0}
                  >
                    <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                    <RadialBar dataKey="value" cornerRadius={6} background={{ fill: '#f1f5f9' }} />
                  </RadialBarChart>
                </ResponsiveContainer>
              </div>
              <div>
                <p className="text-4xl font-bold text-foreground">{onPageStrength}</p>
                <p className="text-xs text-muted-foreground mt-0.5">/ 100</p>
                <p className={cn(
                  'text-xs font-semibold mt-2',
                  onPageStrength >= 70 ? 'text-emerald-600' : onPageStrength >= 40 ? 'text-amber-600' : 'text-red-500'
                )}>
                  {onPageStrength >= 70 ? 'Strong' : onPageStrength >= 40 ? 'Moderate' : 'Needs Work'}
                </p>
              </div>
            </div>
          </div>

          {/* Semantic Entities checklist */}
          <div className="bg-card rounded-xl border border-border shadow-sm p-5 flex-1">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Required Semantic Entities</h3>
            <p className="text-xs text-muted-foreground mb-4">
              {detectedEntities.length}/{ENTITIES.length} detected in your content
            </p>
            <div className="space-y-2.5">
              {ENTITIES.map(entity => {
                const detected = content.toLowerCase().includes(entity.keyword.toLowerCase());
                return (
                  <div
                    key={entity.label}
                    className={cn(
                      'flex items-center gap-3 p-2.5 rounded-lg text-sm transition-all duration-300',
                      detected ? 'bg-emerald-50 border border-emerald-100' : 'bg-muted border border-border'
                    )}
                  >
                    {detected
                      ? <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                      : <Circle size={15} className="text-gray-300 shrink-0" />
                    }
                    <span className={cn(
                      'text-xs font-medium',
                      detected ? 'text-emerald-700' : 'text-muted-foreground'
                    )}>
                      {entity.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      </div>

      <ToolHistoryPanel
        title="Saved Drafts"
        entries={entries}
        activeId={activeId}
        isLoading={isLoading}
        onLoad={entry => {
          void loadEntry(entry.id).then(loaded => {
            const payload = loaded.resultData;
            if (payload && typeof payload === 'object' && 'content' in payload) {
              setContent(String((payload as { content: string }).content));
            }
            setActiveId(entry.id);
          });
        }}
        onDelete={id => void remove(id)}
      />
      </div>
    </div>
  );
}

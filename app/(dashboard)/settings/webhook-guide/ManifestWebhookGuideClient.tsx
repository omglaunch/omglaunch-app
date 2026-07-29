'use client';

import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

type ManifestWebhookGuideClientProps = {
  content: string;
};

export default function ManifestWebhookGuideClient({ content }: ManifestWebhookGuideClientProps) {
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" size="sm" asChild>
          <Link href="/settings?tab=integrations">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back to Integrations
          </Link>
        </Button>
      </div>

      <article className="prose prose-slate max-w-none dark:prose-invert prose-pre:bg-muted prose-pre:text-foreground">
        <ReactMarkdown>{content}</ReactMarkdown>
      </article>
    </div>
  );
}

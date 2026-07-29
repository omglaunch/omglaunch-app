import { Suspense } from 'react';
import AppMain from '@/components/layout/AppMain';
import ArticleStudioErrorBoundary from '@/components/article-studio/ArticleStudioErrorBoundary';
import ArticleStudioClient from './ArticleStudioClient';

function ArticleStudioLoading() {
  return (
    <div className="flex min-h-[200px] flex-1 items-center justify-center text-sm text-gray-500">
      Loading Article Studio…
    </div>
  );
}

export default function ArticleStudioPage() {
  return (
    <AppMain scrollable={false}>
      <ArticleStudioErrorBoundary fallbackTitle="Article Studio Error">
        <Suspense fallback={<ArticleStudioLoading />}>
          <ArticleStudioClient />
        </Suspense>
      </ArticleStudioErrorBoundary>
    </AppMain>
  );
}

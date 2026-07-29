'use client';

import { useState } from 'react';
import AppMain from '@/components/layout/AppMain';
import AnalysisIA from './views/AnalysisIA';
import RankTracker from './views/RankTracker';
import PlaceholderView from './views/PlaceholderView';

export type ViewId =
  | 'analysis-ia'
  | 'page-seo'
  | 'semantic-analysis'
  | 'query-comparison'
  | 'keyword-audit'
  | 'research-volumes'
  | 'suggested-keywords'
  | 'rank-tracker';

export default function Dashboard() {
  const [activeView, setActiveView] = useState<ViewId>('analysis-ia');

  function renderView() {
    switch (activeView) {
      case 'analysis-ia':
        return <AnalysisIA />;
      case 'rank-tracker':
        return <RankTracker />;
      case 'page-seo':
        return (
          <PlaceholderView
            title="Page SEO Analysis"
            description="Analyze on-page SEO factors for any URL — meta tags, heading structure, canonical links, and technical signals."
            toolSlug="seo-analysis"
          />
        );
      case 'semantic-analysis':
        return (
          <PlaceholderView
            title="Semantic Analysis"
            description="Explore the semantic relevance of your content using NLP entity extraction and topic modelling."
            toolSlug="semantic-analysis"
          />
        );
      case 'query-comparison':
        return (
          <PlaceholderView
            title="Query Comparison"
            description="Compare your page's ranking performance across multiple search queries side-by-side."
            toolSlug="query-comparison"
          />
        );
      case 'research-volumes':
        return (
          <PlaceholderView
            title="Research Volumes"
            description="Fetch accurate monthly search volumes and trend data for any keyword or topic cluster."
            toolSlug="research-volumes"
          />
        );
      default:
        return <AnalysisIA />;
    }
  }

  return (
    <AppMain>{renderView()}</AppMain>
  );
}

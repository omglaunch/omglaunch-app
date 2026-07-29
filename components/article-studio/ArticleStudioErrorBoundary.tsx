'use client';

import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Props = {
  children: ReactNode;
  fallbackTitle?: string;
};

type State = {
  hasError: boolean;
  message: string;
};

export default class ArticleStudioErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error.message || 'An unexpected error occurred in Article Studio.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ArticleStudioErrorBoundary]', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, message: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <Card className="mx-auto mt-8 max-w-lg border-red-200 dark:border-red-900/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="h-5 w-5" />
              {this.props.fallbackTitle ?? 'Article Studio Error'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{this.state.message}</p>
            <p className="text-xs text-muted-foreground">
              Your draft metadata is preserved in local state. Try reloading the workspace or
              contact support if the issue persists.
            </p>
            <Button type="button" variant="outline" onClick={this.handleReset}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

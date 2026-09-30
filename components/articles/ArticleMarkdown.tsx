'use client';

import ReactMarkdown from 'react-markdown';

type ArticleMarkdownProps = {
  content: string;
};

export function ArticleMarkdown({ content }: ArticleMarkdownProps) {
  return <ReactMarkdown>{content}</ReactMarkdown>;
}

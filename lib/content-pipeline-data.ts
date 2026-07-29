export type ArticleRecord = {
  id: number;
  briefId: number;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type ContentBriefRecord = {
  id: number;
  targetKeyword: string;
  targetUrl: string;
  content: string;
  createdAt: string;
  articles: ArticleRecord[];
};

export type ArticleStudioData = {
  briefs: ContentBriefRecord[];
  articles: ArticleRecord[];
};

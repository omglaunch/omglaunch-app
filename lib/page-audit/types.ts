export type RecentPageAudit = {
  historyId: string;
  id: number;
  createdAt: Date;
  url: string;
  targetKeyword: string;
  geoScore: number;
  auditData: unknown;
};

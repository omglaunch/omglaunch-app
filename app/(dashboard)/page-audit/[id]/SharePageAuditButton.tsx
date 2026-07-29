'use client';

import ShareLinkDialog from '@/components/client-share/ShareLinkDialog';
import { useProject } from '@/components/projects/ProjectProvider';
import { useTeamAccess } from '@/components/team/TeamAccessProvider';

type SharePageAuditButtonProps = {
  auditId: number;
};

export default function SharePageAuditButton({ auditId }: SharePageAuditButtonProps) {
  const { activeProjectId } = useProject();
  const { canWrite } = useTeamAccess();

  if (!canWrite || !activeProjectId) {
    return null;
  }

  return (
    <ShareLinkDialog
      projectId={activeProjectId}
      reportType="page_audit"
      sourceId={auditId}
      triggerLabel="Share report link"
    />
  );
}

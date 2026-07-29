"use server";

import {
  savePageAudit as savePageAuditImpl,
  type SavePageAuditInput,
} from '@/lib/page-audit/save-audit';

export type { SavePageAuditInput };

export async function savePageAudit(data: SavePageAuditInput) {
  return savePageAuditImpl(data);
}

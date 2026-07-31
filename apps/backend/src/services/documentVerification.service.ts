import { DocumentVerificationStatus } from '@prisma/client';
import prisma from '../config/prisma';
import { notifyUser } from '../utils/notify';

// VendorDocument, RiderDocument, and TechnicianDocument all go through the
// same admin verify/reject flow (validate status, update the row, audit-log
// the change, notify the document's owner). Shared here; each caller
// (vendor/rider/technician.controller.ts) supplies only the model-specific
// bits -- which document to load, how the owning user is found, and the
// audit/notification labels -- so this is the one place the flow is written.

export class InvalidDocumentStatusError extends Error {}
export class DocumentNotFoundError extends Error {}

type DocumentRow = { id: string; type: string; status: DocumentVerificationStatus };

export async function reviewDocument<T extends DocumentRow>(params: {
  reviewerUserId: string;
  status: unknown;
  remarks?: string;
  loadDocument: () => Promise<T | null>;
  updateDocument: (status: DocumentVerificationStatus, remarks: string | null) => Promise<T>;
  loadOwnerUserId: () => Promise<string | null>;
  auditAction: string;
  auditEntity: string;
  notifyType: string;
}): Promise<T> {
  if (!Object.values(DocumentVerificationStatus).includes(params.status as DocumentVerificationStatus)) {
    throw new InvalidDocumentStatusError();
  }
  const status = params.status as DocumentVerificationStatus;
  const remarks = params.remarks || null;

  const document = await params.loadDocument();
  if (!document) {
    throw new DocumentNotFoundError();
  }

  const updated = await params.updateDocument(status, remarks);

  await prisma.auditLog.create({
    data: {
      userId: params.reviewerUserId,
      action: params.auditAction,
      entity: params.auditEntity,
      entityId: document.id,
      details: `${document.type}: ${document.status} -> ${status}${remarks ? ` (${remarks})` : ''}`,
    },
  });

  const ownerUserId = await params.loadOwnerUserId();
  if (ownerUserId) {
    notifyUser(
      ownerUserId,
      'Document review update',
      `Your ${document.type.replace(/_/g, ' ')} document was marked ${status}${remarks ? `: ${remarks}` : '.'}`,
      { type: params.notifyType, documentId: document.id, status }
    );
  }

  return updated;
}

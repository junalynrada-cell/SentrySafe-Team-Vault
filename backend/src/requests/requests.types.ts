export class CreateAccessRequestDto {
  secret_id!: string;
  business_reason!: string;
  requested_duration_minutes!: number;
}

export class ReviewRequestDto {
  reviewer_note?: string;
}

export interface AccessRequestSummary {
  id: string;
  org_id: string;
  secret_id: string;
  secret_name: string;
  resource_type: string;
  environment: string;
  requester_id: string;
  requester_name: string;
  requester_email: string;
  business_reason: string;
  requested_duration_minutes: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'REVOKED';
  reviewed_by: string | null;
  reviewer_name: string | null;
  reviewed_at: string | null;
  reviewer_note: string | null;
  valid_until: string;
  created_at: string;
  expires_at?: string | null;
}

export interface SecretSummary {
  id: string;
  name: string;
  description: string;
  resource_type: string;
  environment: string;
  owner_team: string;
  requires_approval: boolean;
  access_level: string;
  tags: string[];
  masked_preview: string;
  last_rotated_at: string | null;
  created_at: string;
  has_active_grant?: boolean;
  active_grant_id?: string | null;
  grant_expires_at?: string | null;
}

export class CreateSecretDto {
  name!: string;
  description?: string;
  resource_type!: 'DATABASE_CREDENTIAL' | 'API_KEY' | 'SERVICE_TOKEN' | 'CLOUD_CREDENTIAL';
  environment!: 'PRODUCTION' | 'STAGING' | 'DEVELOPMENT';
  owner_team!: string;
  requires_approval!: boolean;
  access_level!: 'RESTRICTED' | 'CONFIDENTIAL';
  tags?: string[];
  plaintext_value!: string;
}

/**
 * All fields are optional. Only provided fields are updated.
 * If plaintext_value is provided, the new value is encrypted using AES-256-GCM
 * and replaces the existing ciphertext. If omitted, the existing encrypted value
 * is preserved — the plaintext is never exposed or required just to update metadata.
 */
export class UpdateSecretDto {
  name?: string;
  description?: string;
  resource_type?: 'DATABASE_CREDENTIAL' | 'API_KEY' | 'SERVICE_TOKEN' | 'CLOUD_CREDENTIAL';
  environment?: 'PRODUCTION' | 'STAGING' | 'DEVELOPMENT';
  owner_team?: string;
  requires_approval?: boolean;
  access_level?: 'RESTRICTED' | 'CONFIDENTIAL';
  tags?: string[];
  /** Optional replacement secret value. Will be AES-256-GCM encrypted before storage. */
  plaintext_value?: string;
}


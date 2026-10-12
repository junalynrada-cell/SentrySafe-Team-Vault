import {
  Injectable,
  UnauthorizedException,
  HttpException,
  HttpStatus,
  Logger,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as argon2 from 'argon2';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { DatabaseService } from '../database/database.service';
import { AuditService } from '../audit/audit.service';
import {
  SafeUser,
  OrganizationMembership,
  SessionRecord,
  AuthContext,
  PreAuthContext,
  UserRole,
} from './auth.types';

export class LoginDto {
  email!: string;
  password!: string;
}

export class SignupDto {
  name!: string;
  email!: string;
  password!: string;
}

export class Verify2faDto {
  code?: string;
  backupCode?: string;
}

export interface RequestMetadata {
  ipAddress?: string;
  userAgent?: string;
}

const ABSOLUTE_SESSION_TIMEOUT_MS = 8 * 60 * 60 * 1000; // 8 hours absolute
const IDLE_SESSION_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes idle
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly masterKey: Buffer;

  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
  ) {
    const rawKey =
      process.env.VAULT_MASTER_KEY ||
      '4e2f8c6b1a9d3e5f7a0b2c4d6e8f1a3b5c7d9e1f3a5b7c9d1e3f5a7b9c1d3e5f';
    this.masterKey = Buffer.from(rawKey, 'hex');
  }

  /**
   * Hashes a raw token using SHA-256 for persistent database lookup.
   */
  hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  /**
   * Hashes a password using Argon2id.
   */
  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id });
  }

  /**
   * Encrypts a plaintext TOTP secret with AES-256-GCM.
   */
  encryptTotpSecret(plainSecret: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.masterKey, iv);
    let ciphertext = cipher.update(plainSecret, 'utf8', 'base64');
    ciphertext += cipher.final('base64');
    const authTag = cipher.getAuthTag().toString('base64');
    return `${iv.toString('base64')}:${authTag}:${ciphertext}`;
  }

  /**
   * Decrypts an AES-256-GCM encrypted TOTP secret.
   */
  decryptTotpSecret(encryptedString: string): string {
    const parts = encryptedString.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted TOTP secret format');
    }
    const [ivB64, authTagB64, ciphertext] = parts;
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.masterKey, iv);
    decipher.setAuthTag(authTag);
    let plaintext = decipher.update(ciphertext, 'base64', 'utf8');
    plaintext += decipher.final('utf8');
    return plaintext;
  }

  /**
   * Generates a 5-minute pre-authentication session token and persists its SHA-256 hash.
   */
  async createPreAuthSession(userId: string): Promise<string> {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);

    await this.db.query(
      `INSERT INTO pre_auth_sessions (
        user_id, token_hash, created_at, expires_at, failed_attempts
      ) VALUES ($1, $2, NOW(), NOW() + INTERVAL '5 minutes', 0)`,
      [userId, tokenHash],
    );

    return rawToken;
  }

  /**
   * Validates a pre-authentication session token (5-minute TTL, unconsumed, <5 failures).
   */
  async validatePreAuth(
    rawToken: string,
    meta?: RequestMetadata,
  ): Promise<PreAuthContext> {
    if (!rawToken) {
      throw new UnauthorizedException('Pre-authentication token missing');
    }

    const tokenHash = this.hashToken(rawToken);

    const row = await this.db.queryOne<any>(
      `SELECT 
        p.id AS pre_auth_id, p.user_id, p.token_hash, p.created_at, p.expires_at,
        p.consumed_at, p.failed_attempts,
        u.email, u.full_name, u.is_active, u.totp_enabled,
        m.id AS member_id, m.org_id, m.role, m.status AS member_status, m.removed_at,
        o.name AS org_name, o.slug AS org_slug
      FROM pre_auth_sessions p
      JOIN users u ON u.id = p.user_id
      LEFT JOIN organization_members m ON m.user_id = u.id
      LEFT JOIN organizations o ON o.id = m.org_id
      WHERE p.token_hash = $1
      ORDER BY 
        CASE m.status
          WHEN 'ACTIVE' THEN 1
          WHEN 'PENDING' THEN 2
          WHEN 'REMOVED' THEN 3
          ELSE 4
        END
      LIMIT 1`,
      [tokenHash],
    );

    if (!row) {
      throw new UnauthorizedException('Pre-authentication session not found');
    }

    if (row.consumed_at) {
      throw new UnauthorizedException('Pre-authentication session has already been consumed');
    }

    if (new Date(row.expires_at).getTime() <= Date.now()) {
      await this.audit.log({
        orgId: row.org_id || '00000000-0000-0000-0000-000000000000',
        actorId: row.user_id,
        actorEmail: row.email,
        actorRole: row.role || 'UNASSIGNED',
        action: 'PRE_AUTH_EXPIRED',
        resourceType: 'SESSION',
        resourceId: row.pre_auth_id,
        resourceName: 'Pre-Authentication Session',
        status: 'AUTOMATIC',
        details: { reason: 'Pre-authentication session expired after 5 minutes' },
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      });
      throw new UnauthorizedException(
        'Pre-authentication session has expired (5-minute limit). Please log in again.',
      );
    }

    if (row.failed_attempts >= MAX_FAILED_ATTEMPTS) {
      throw new UnauthorizedException(
        'Pre-authentication session locked due to excessive failed attempts. Please log in again.',
      );
    }

    if (!row.is_active) {
      throw new UnauthorizedException('User account is deactivated');
    }

    const user: SafeUser = {
      id: row.user_id,
      email: row.email,
      full_name: row.full_name,
      name: row.full_name,
      is_active: row.is_active,
      totp_enabled: Boolean(row.totp_enabled),
    };

    const membership: OrganizationMembership = {
      id: row.member_id,
      org_id: row.org_id,
      org_name: row.org_name,
      org_slug: row.org_slug,
      role: (row.role as UserRole) || null,
      status: row.member_status || 'PENDING',
      removed_at: row.removed_at || null,
    };

    return {
      preAuthSession: {
        id: row.pre_auth_id,
        user_id: row.user_id,
        token_hash: row.token_hash,
        created_at: row.created_at,
        expires_at: row.expires_at,
        consumed_at: row.consumed_at,
        failed_attempts: row.failed_attempts,
      },
      user,
      membership,
      rawToken,
    };
  }

  /**
   * Helper to create a new full session (8-hour absolute lifespan).
   */
  async createFullSession(
    userId: string,
    meta?: RequestMetadata,
  ): Promise<{ rawToken: string; session: SessionRecord }> {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);

    const sessionRes = await this.db.queryOne<SessionRecord>(
      `INSERT INTO sessions (
        user_id, session_token_hash, created_at, last_activity_at,
        expires_at, is_locked, is_revoked, ip_address, user_agent
      ) VALUES (
        $1, $2, NOW(), NOW(),
        NOW() + INTERVAL '8 hours', FALSE, FALSE, $3, $4
      ) RETURNING *`,
      [userId, tokenHash, meta?.ipAddress || null, meta?.userAgent || null],
    );

    return { rawToken, session: sessionRes! };
  }

  /**
   * Registers a new user account with PENDING membership and creates pre-auth session for 2FA enrollment.
   */
  async signup(
    dto: SignupDto,
    meta: RequestMetadata,
  ): Promise<{
    success: boolean;
    message: string;
    requiresEnrollment: boolean;
    preAuthToken: string;
    user: SafeUser;
    status: string;
  }> {
    const fullName = (dto.name || '').trim();
    const email = (dto.email || '').trim().toLowerCase();
    const password = dto.password || '';

    if (!fullName || fullName.length < 2) {
      throw new BadRequestException('Full name is required (minimum 2 characters)');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      throw new BadRequestException('A valid business email address is required');
    }

    if (!password || password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters long');
    }

    // 1. Check if user already exists
    const existingUser = await this.db.queryOne<any>(
      `SELECT id FROM users WHERE LOWER(email) = $1`,
      [email],
    );

    if (existingUser) {
      throw new ConflictException('An account with this email address already exists');
    }

    // 2. Fetch primary organization
    const org = await this.db.queryOne<any>(
      `SELECT id, name FROM organizations ORDER BY created_at ASC LIMIT 1`,
    );

    if (!org) {
      throw new BadRequestException('No active organization found to join');
    }

    // 3. Hash password using Argon2id
    const passwordHash = await this.hashPassword(password);

    // 4. Create user and pending membership in an atomic transaction
    let newUserId = '';
    await this.db.transaction(async (client) => {
      const userRes = await client.query(
        `INSERT INTO users (email, password_hash, full_name, is_active, totp_enabled)
         VALUES ($1, $2, $3, TRUE, FALSE)
         RETURNING id`,
        [email, passwordHash, fullName],
      );
      newUserId = userRes.rows[0].id;

      await client.query(
        `INSERT INTO organization_members (org_id, user_id, role, status)
         VALUES ($1, $2, NULL, 'PENDING')`,
        [org.id, newUserId],
      );
    });

    // 5. Audit SIGNUP event
    await this.audit.log({
      orgId: org.id,
      actorId: newUserId,
      actorEmail: email,
      actorRole: 'UNASSIGNED',
      action: 'SIGNUP',
      resourceType: 'USER',
      resourceId: newUserId,
      resourceName: email,
      status: 'SUCCESS',
      details: {
        reason: 'User self-registration; 2FA setup required before full session issuance',
      },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    // 6. Create 5-minute pre-authentication session for immediate 2FA enrollment
    const preAuthToken = await this.createPreAuthSession(newUserId);

    return {
      success: true,
      message: 'Account created. Please configure Google Authenticator Two-Factor Authentication.',
      requiresEnrollment: true,
      preAuthToken,
      user: {
        id: newUserId,
        email,
        full_name: fullName,
        name: fullName,
        is_active: true,
        totp_enabled: false,
      },
      status: 'PENDING',
    };
  }

  /**
   * First phase of authentication: verifies password and returns pre-authentication state.
   * A correct password NEVER immediately creates a full session.
   */
  async login(
    dto: LoginDto,
    meta: RequestMetadata,
  ): Promise<{
    requiresTwoFactor: true;
    requiresEnrollment: boolean;
    preAuthToken: string;
    email: string;
  }> {
    const email = dto.email.trim().toLowerCase();

    // 1. Fetch user by email
    const userRes = await this.db.queryOne<any>(
      `SELECT id, email, password_hash, full_name, is_active, failed_login_attempts, locked_until, totp_enabled, totp_secret_encrypted
       FROM users WHERE email = $1`,
      [email],
    );

    if (!userRes) {
      // Dummy verify to mitigate timing attacks
      await argon2.verify(
        '$argon2id$v=19$m=65536,p=4,t=3$v5EGskI8pUZYtxzkSauJLA$5m3JgpW8NqZYhegUTGazFlUvg5lzWaIoO9H2MSNCt1w',
        dto.password,
      );
      throw new UnauthorizedException('Invalid email or password');
    }

    // 2. Check if account is locked due to brute-force attempts
    if (userRes.locked_until && new Date(userRes.locked_until) > new Date()) {
      const remainingMinutes = Math.ceil(
        (new Date(userRes.locked_until).getTime() - Date.now()) / (60 * 1000),
      );
      throw new HttpException(
        `Account is temporarily locked due to excessive failed attempts. Try again in ${remainingMinutes} minute(s).`,
        HttpStatus.LOCKED,
      );
    }

    if (!userRes.is_active) {
      throw new UnauthorizedException('User account is deactivated');
    }

    // 3. Verify Argon2id password hash
    let passwordValid = false;
    try {
      passwordValid = await argon2.verify(userRes.password_hash, dto.password);
    } catch (err) {
      this.logger.error('Error verifying Argon2 password hash', err);
      passwordValid = false;
    }

    // 4. Handle failed login
    if (!passwordValid) {
      const newAttempts = userRes.failed_login_attempts + 1;
      let lockoutSql = '';
      const params: any[] = [newAttempts, userRes.id];

      if (newAttempts >= MAX_FAILED_ATTEMPTS) {
        lockoutSql = `, locked_until = NOW() + INTERVAL '${LOCKOUT_DURATION_MINUTES} minutes'`;
      }

      await this.db.query(
        `UPDATE users SET failed_login_attempts = $1 ${lockoutSql}, updated_at = NOW() WHERE id = $2`,
        params,
      );

      // Audit failed password verification
      const defaultOrg = await this.db.queryOne<{ org_id: string }>(
        `SELECT org_id FROM organization_members WHERE user_id = $1 LIMIT 1`,
        [userRes.id],
      );

      if (defaultOrg) {
        await this.audit.log({
          orgId: defaultOrg.org_id,
          actorId: userRes.id,
          actorEmail: userRes.email,
          actorRole: 'UNKNOWN',
          action: 'LOGIN',
          resourceType: 'SESSION',
          resourceId: userRes.id,
          resourceName: 'User Password Verification',
          status: 'FAILURE',
          details: { reason: 'Incorrect password', failedAttempts: newAttempts },
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        });
      }

      throw new UnauthorizedException('Invalid email or password');
    }

    // 5. Reset failed password attempts on successful password verification
    await this.db.query(
      `UPDATE users SET failed_login_attempts = 0, locked_until = NULL, updated_at = NOW() WHERE id = $1`,
      [userRes.id],
    );

    // 6. Generate 5-minute pre-authentication session token
    const preAuthToken = await this.createPreAuthSession(userRes.id);

    const hasValidTotp =
      Boolean(userRes.totp_enabled) && Boolean(userRes.totp_secret_encrypted);

    return {
      requiresTwoFactor: true,
      requiresEnrollment: !hasValidTotp,
      preAuthToken,
      email: userRes.email,
    };
  }

  /**
   * Second phase of authentication: verifies 6-digit TOTP or one-time backup code,
   * then creates the full 8-hour session.
   */
  async verify2fa(
    preAuth: PreAuthContext,
    dto: Verify2faDto,
    meta: RequestMetadata,
  ): Promise<{
    user: SafeUser;
    session: SessionRecord;
    membership: OrganizationMembership;
    rawToken: string;
  }> {
    const code = dto.code ? dto.code.trim() : '';
    const backupCode = dto.backupCode ? dto.backupCode.trim() : '';

    if (!code && !backupCode) {
      throw new BadRequestException('A 6-digit verification code or backup code is required');
    }

    // A. 6-Digit RFC 6238 TOTP Verification
    if (code) {
      if (!/^\d{6}$/.test(code)) {
        throw new BadRequestException('Verification code must be exactly 6 digits');
      }

      const userRow = await this.db.queryOne<{
        totp_secret_encrypted: string;
        totp_enabled: boolean;
      }>(
        `SELECT totp_secret_encrypted, totp_enabled FROM users WHERE id = $1`,
        [preAuth.user.id],
      );

      if (!userRow || !userRow.totp_secret_encrypted || !userRow.totp_enabled) {
        throw new BadRequestException(
          'Two-factor authentication is not enrolled for this user. Enrollment required.',
        );
      }

      let secret = '';
      try {
        secret = this.decryptTotpSecret(userRow.totp_secret_encrypted);
      } catch (err) {
        this.logger.error('Failed to decrypt TOTP secret', err);
        throw new UnauthorizedException('Authentication failed. Please contact administrator.');
      }

      const isTotpValid = speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token: code,
        window: 1,
      });

      if (!isTotpValid) {
        const nextAttempts = preAuth.preAuthSession.failed_attempts + 1;
        let consumedSql = '';
        if (nextAttempts >= MAX_FAILED_ATTEMPTS) {
          consumedSql = `, consumed_at = NOW()`;
        }

        await this.db.query(
          `UPDATE pre_auth_sessions SET failed_attempts = $1 ${consumedSql} WHERE id = $2`,
          [nextAttempts, preAuth.preAuthSession.id],
        );

        await this.audit.log({
          orgId: preAuth.membership.org_id,
          actorId: preAuth.user.id,
          actorEmail: preAuth.user.email,
          actorRole: preAuth.membership.role || 'UNASSIGNED',
          action: 'TOTP_VERIFICATION_FAILED',
          resourceType: 'SESSION',
          resourceId: preAuth.preAuthSession.id,
          resourceName: 'TOTP 2FA Verification',
          status: 'FAILURE',
          details: {
            reason:
              nextAttempts >= MAX_FAILED_ATTEMPTS
                ? 'Too many failed 2FA attempts; pre-auth session invalidated'
                : 'Invalid 6-digit TOTP code',
            failedAttempts: nextAttempts,
          },
          ipAddress: meta?.ipAddress,
          userAgent: meta?.userAgent,
        });

        if (nextAttempts >= MAX_FAILED_ATTEMPTS) {
          throw new UnauthorizedException(
            'Too many invalid attempts. Pre-authentication expired. Please log in again.',
          );
        }

        throw new UnauthorizedException('Invalid 6-digit verification code');
      }

      // Mark pre-auth session as consumed
      await this.db.query(
        `UPDATE pre_auth_sessions SET consumed_at = NOW() WHERE id = $1`,
        [preAuth.preAuthSession.id],
      );

      // Audit TOTP Success
      await this.audit.log({
        orgId: preAuth.membership.org_id,
        actorId: preAuth.user.id,
        actorEmail: preAuth.user.email,
        actorRole: preAuth.membership.role || 'UNASSIGNED',
        action: 'TOTP_VERIFICATION_SUCCESS',
        resourceType: 'SESSION',
        resourceId: preAuth.preAuthSession.id,
        resourceName: 'TOTP 2FA Verification',
        status: 'SUCCESS',
        details: { method: 'RFC_6238_TOTP' },
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      });
    }

    // B. Backup Code Verification
    if (backupCode) {
      const normalized = backupCode.replace(/[-\s]/g, '').toUpperCase();
      const codeHash = this.hashToken(normalized);

      const matchingCode = await this.db.queryOne<{ id: string }>(
        `SELECT id FROM backup_codes WHERE user_id = $1 AND code_hash = $2 AND used_at IS NULL LIMIT 1`,
        [preAuth.user.id, codeHash],
      );

      if (!matchingCode) {
        const nextAttempts = preAuth.preAuthSession.failed_attempts + 1;
        let consumedSql = '';
        if (nextAttempts >= MAX_FAILED_ATTEMPTS) {
          consumedSql = `, consumed_at = NOW()`;
        }

        await this.db.query(
          `UPDATE pre_auth_sessions SET failed_attempts = $1 ${consumedSql} WHERE id = $2`,
          [nextAttempts, preAuth.preAuthSession.id],
        );

        await this.audit.log({
          orgId: preAuth.membership.org_id,
          actorId: preAuth.user.id,
          actorEmail: preAuth.user.email,
          actorRole: preAuth.membership.role || 'UNASSIGNED',
          action: 'TOTP_VERIFICATION_FAILED',
          resourceType: 'SESSION',
          resourceId: preAuth.preAuthSession.id,
          resourceName: 'Backup Code Verification',
          status: 'FAILURE',
          details: { reason: 'Invalid or already used backup code' },
          ipAddress: meta?.ipAddress,
          userAgent: meta?.userAgent,
        });

        if (nextAttempts >= MAX_FAILED_ATTEMPTS) {
          throw new UnauthorizedException(
            'Too many invalid attempts. Pre-authentication expired. Please log in again.',
          );
        }

        throw new UnauthorizedException('Invalid or already used backup code');
      }

      // Mark backup code as used
      await this.db.query(
        `UPDATE backup_codes SET used_at = NOW() WHERE id = $1`,
        [matchingCode.id],
      );

      // Consume pre-auth session
      await this.db.query(
        `UPDATE pre_auth_sessions SET consumed_at = NOW() WHERE id = $1`,
        [preAuth.preAuthSession.id],
      );

      // Audit BACKUP_CODE_USED (never log the code itself)
      await this.audit.log({
        orgId: preAuth.membership.org_id,
        actorId: preAuth.user.id,
        actorEmail: preAuth.user.email,
        actorRole: preAuth.membership.role || 'UNASSIGNED',
        action: 'BACKUP_CODE_USED',
        resourceType: 'SESSION',
        resourceId: matchingCode.id,
        resourceName: 'Backup Code Verification',
        status: 'SUCCESS',
        details: { method: 'BACKUP_CODE' },
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      });
    }

    // Generate brand new full session (8-hour absolute expiry)
    const { rawToken, session } = await this.createFullSession(preAuth.user.id, meta);

    // Audit SESSION_CREATED
    await this.audit.log({
      orgId: preAuth.membership.org_id,
      actorId: preAuth.user.id,
      actorEmail: preAuth.user.email,
      actorRole: preAuth.membership.role || 'UNASSIGNED',
      action: 'SESSION_CREATED',
      resourceType: 'SESSION',
      resourceId: session.id,
      resourceName: 'User Session Created',
      status: 'SUCCESS',
      details: { absoluteLifespanHours: 8, idleTimeoutMinutes: 15 },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return {
      user: { ...preAuth.user, totp_enabled: true },
      session,
      membership: preAuth.membership,
      rawToken,
    };
  }

  /**
   * Initiates TOTP 2FA enrollment by generating a random Base32 secret and QR code.
   */
  async startTotpEnrollment(
    preAuth: PreAuthContext,
    meta?: RequestMetadata,
  ): Promise<{ qrCodeUrl: string; manualKey: string; email: string }> {
    // Protect valid active TOTP enrollments from being overwritten
    const existingUser = await this.db.queryOne<{
      totp_enabled: boolean;
      totp_secret_encrypted: string | null;
    }>(
      `SELECT totp_enabled, totp_secret_encrypted FROM users WHERE id = $1`,
      [preAuth.user.id],
    );

    if (existingUser?.totp_enabled && existingUser?.totp_secret_encrypted) {
      throw new BadRequestException(
        'Account already has active 2FA enabled. Re-enrollment is not permitted while 2FA is active.',
      );
    }

    const secretObj = speakeasy.generateSecret({
      length: 20,
      name: `SentrySafe Team Vault (${preAuth.user.email})`,
      issuer: 'SentrySafe Team Vault',
    });
    const secret = secretObj.base32;
    const encryptedSecret = this.encryptTotpSecret(secret);

    // Save encrypted secret in users (totp_enabled stays FALSE until verified)
    await this.db.query(
      `UPDATE users SET totp_secret_encrypted = $1, totp_enabled = FALSE WHERE id = $2`,
      [encryptedSecret, preAuth.user.id],
    );

    const otpauthUrl =
      secretObj.otpauth_url ||
      speakeasy.otpauthURL({
        secret,
        label: preAuth.user.email,
        issuer: 'SentrySafe Team Vault',
        encoding: 'base32',
      });

    const qrCodeUrl = await QRCode.toDataURL(otpauthUrl, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 220,
    });

    await this.audit.log({
      orgId: preAuth.membership.org_id,
      actorId: preAuth.user.id,
      actorEmail: preAuth.user.email,
      actorRole: preAuth.membership.role || 'UNASSIGNED',
      action: 'TOTP_ENROLLMENT_STARTED',
      resourceType: 'USER',
      resourceId: preAuth.user.id,
      resourceName: preAuth.user.email,
      status: 'SUCCESS',
      details: { reason: 'User initiated TOTP 2FA enrollment' },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return {
      qrCodeUrl,
      manualKey: secret,
      email: preAuth.user.email,
    };
  }

  /**
   * Verifies the 6-digit TOTP code during enrollment and generates 8 backup codes.
   */
  async verifyTotpEnrollment(
    preAuth: PreAuthContext,
    code: string,
    meta?: RequestMetadata,
  ): Promise<{ backupCodes: string[] }> {
    if (!code || !/^\d{6}$/.test(code.trim())) {
      throw new BadRequestException('Verification code must be exactly 6 digits');
    }

    const userRow = await this.db.queryOne<{ totp_secret_encrypted: string }>(
      `SELECT totp_secret_encrypted FROM users WHERE id = $1`,
      [preAuth.user.id],
    );

    if (!userRow || !userRow.totp_secret_encrypted) {
      throw new BadRequestException('No pending TOTP enrollment found');
    }

    let secret = '';
    try {
      secret = this.decryptTotpSecret(userRow.totp_secret_encrypted);
    } catch {
      throw new BadRequestException('Failed to process enrollment');
    }

    const isValid = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: code.trim(),
      window: 1,
    });
    if (!isValid) {
      throw new BadRequestException(
        'Invalid verification code. Please check your Google Authenticator app.',
      );
    }

    // Enable TOTP for user
    await this.db.query(
      `UPDATE users SET totp_enabled = TRUE, totp_enrolled_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [preAuth.user.id],
    );

    // Delete any previous unused backup codes for this user
    await this.db.query(`DELETE FROM backup_codes WHERE user_id = $1`, [
      preAuth.user.id,
    ]);

    // Generate 8 backup codes (format: XXXX-XXXX)
    const backupCodes: string[] = [];
    for (let i = 0; i < 8; i++) {
      const part1 = crypto.randomBytes(2).toString('hex').toUpperCase();
      const part2 = crypto.randomBytes(2).toString('hex').toUpperCase();
      const rawCode = `${part1}-${part2}`;
      backupCodes.push(rawCode);
      const codeHash = this.hashToken(rawCode.replace(/-/g, ''));
      await this.db.query(
        `INSERT INTO backup_codes (user_id, code_hash, created_at) VALUES ($1, $2, NOW())`,
        [preAuth.user.id, codeHash],
      );
    }

    await this.audit.log({
      orgId: preAuth.membership.org_id,
      actorId: preAuth.user.id,
      actorEmail: preAuth.user.email,
      actorRole: preAuth.membership.role || 'UNASSIGNED',
      action: 'TOTP_ENROLLMENT_COMPLETED',
      resourceType: 'USER',
      resourceId: preAuth.user.id,
      resourceName: preAuth.user.email,
      status: 'SUCCESS',
      details: { backupCodesCount: backupCodes.length },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return { backupCodes };
  }

  /**
   * Finalizes TOTP enrollment after user acknowledges saving backup codes and issues full session.
   */
  async completeTotpEnrollment(
    preAuth: PreAuthContext,
    meta?: RequestMetadata,
  ): Promise<{
    user: SafeUser;
    session: SessionRecord;
    membership: OrganizationMembership;
    rawToken: string;
  }> {
    const userRow = await this.db.queryOne<{ totp_enabled: boolean }>(
      `SELECT totp_enabled FROM users WHERE id = $1`,
      [preAuth.user.id],
    );

    if (!userRow || !userRow.totp_enabled) {
      throw new BadRequestException('TOTP enrollment must be verified before completing');
    }

    // Consume pre-auth session
    await this.db.query(
      `UPDATE pre_auth_sessions SET consumed_at = NOW() WHERE id = $1`,
      [preAuth.preAuthSession.id],
    );

    // Create NEW full session (8-hour absolute expiry)
    const { rawToken, session } = await this.createFullSession(preAuth.user.id, meta);

    // Audit SESSION_CREATED
    await this.audit.log({
      orgId: preAuth.membership.org_id,
      actorId: preAuth.user.id,
      actorEmail: preAuth.user.email,
      actorRole: preAuth.membership.role || 'UNASSIGNED',
      action: 'SESSION_CREATED',
      resourceType: 'SESSION',
      resourceId: session.id,
      resourceName: 'User Session Created',
      status: 'SUCCESS',
      details: {
        reason: '2FA Enrollment completed',
        absoluteLifespanHours: 8,
        idleTimeoutMinutes: 15,
      },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return {
      user: { ...preAuth.user, totp_enabled: true },
      session,
      membership: preAuth.membership,
      rawToken,
    };
  }

  /**
   * Validates full session token, checks revocation, 8-hour absolute timeout, and 15-minute idle timeout.
   */
  async validateSession(
    rawToken: string,
    meta?: RequestMetadata,
  ): Promise<AuthContext> {
    if (!rawToken) {
      throw new UnauthorizedException('Authentication token missing');
    }

    const tokenHash = this.hashToken(rawToken);

    const row = await this.db.queryOne<any>(
      `SELECT 
        s.id AS session_id, s.user_id, s.session_token_hash, s.created_at AS session_created_at,
        s.last_activity_at, s.expires_at, s.is_locked, s.is_revoked,
        u.email, u.full_name, u.is_active, u.totp_enabled,
        m.id AS member_id, m.org_id, m.role, m.status AS member_status, m.removed_at,
        o.name AS org_name, o.slug AS org_slug
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      LEFT JOIN organization_members m ON m.user_id = u.id
      LEFT JOIN organizations o ON o.id = m.org_id
      WHERE s.session_token_hash = $1
      ORDER BY 
        CASE m.status
          WHEN 'ACTIVE' THEN 1
          WHEN 'PENDING' THEN 2
          WHEN 'REMOVED' THEN 3
          ELSE 4
        END
      LIMIT 1`,
      [tokenHash],
    );

    if (!row) {
      throw new UnauthorizedException('Session not found or invalid');
    }

    if (row.is_revoked) {
      throw new UnauthorizedException('Session has been revoked');
    }

    if (!row.is_active) {
      throw new UnauthorizedException('User account is deactivated');
    }

    // 1. Check absolute expiration (8 hours from session creation)
    const createdAtTime = new Date(row.session_created_at).getTime();
    if (
      Date.now() - createdAtTime >= ABSOLUTE_SESSION_TIMEOUT_MS ||
      new Date(row.expires_at).getTime() <= Date.now()
    ) {
      await this.db.query(
        `UPDATE sessions SET is_revoked = TRUE WHERE id = $1`,
        [row.session_id],
      );
      await this.audit.log({
        orgId: row.org_id || '00000000-0000-0000-0000-000000000000',
        actorId: row.user_id,
        actorEmail: row.email,
        actorRole: row.role || 'UNASSIGNED',
        action: 'SESSION_EXPIRED',
        resourceType: 'SESSION',
        resourceId: row.session_id,
        resourceName: 'Absolute Session Timeout',
        status: 'AUTOMATIC',
        details: { reason: '8-hour absolute session duration reached' },
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      });
      throw new UnauthorizedException('Session expired (8-hour absolute limit). Please log in again.');
    }

    // 2. Check idle timeout (15 minutes of inactivity)
    const lastActivityTime = new Date(row.last_activity_at).getTime();
    if (Date.now() - lastActivityTime > IDLE_SESSION_TIMEOUT_MS) {
      await this.db.query(
        `UPDATE sessions SET is_revoked = TRUE WHERE id = $1`,
        [row.session_id],
      );
      await this.audit.log({
        orgId: row.org_id || '00000000-0000-0000-0000-000000000000',
        actorId: row.user_id,
        actorEmail: row.email,
        actorRole: row.role || 'UNASSIGNED',
        action: 'SESSION_IDLE_TIMEOUT',
        resourceType: 'SESSION',
        resourceId: row.session_id,
        resourceName: 'Idle Session Timeout',
        status: 'AUTOMATIC',
        details: { inactiveForMs: Date.now() - lastActivityTime },
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      });
      throw new UnauthorizedException('Session expired due to 15-minute inactivity. Please log in again.');
    }

    // 3. Update activity timestamp (does NOT extend 8-hour absolute expiration)
    await this.db.query(
      `UPDATE sessions SET last_activity_at = NOW() WHERE id = $1`,
      [row.session_id],
    );

    const user: SafeUser = {
      id: row.user_id,
      email: row.email,
      full_name: row.full_name,
      name: row.full_name,
      is_active: row.is_active,
      totp_enabled: Boolean(row.totp_enabled),
    };

    const session: SessionRecord = {
      id: row.session_id,
      user_id: row.user_id,
      session_token_hash: row.session_token_hash,
      created_at: row.session_created_at,
      last_activity_at: new Date().toISOString(),
      expires_at: row.expires_at,
      is_locked: row.is_locked,
      is_revoked: row.is_revoked,
      ip_address: meta?.ipAddress || null,
      user_agent: meta?.userAgent || null,
    };

    const membership: OrganizationMembership = {
      id: row.member_id,
      org_id: row.org_id,
      org_name: row.org_name,
      org_slug: row.org_slug,
      role: (row.role as UserRole) || null,
      status: row.member_status || 'PENDING',
      removed_at: row.removed_at || null,
    };

    return { user, session, membership };
  }

  /**
   * Manually locks vault session for the authenticated user.
   */
  async lockSession(
    rawToken: string,
    meta: RequestMetadata,
  ): Promise<{ success: boolean; message: string }> {
    const tokenHash = this.hashToken(rawToken);

    const session = await this.db.queryOne<any>(
      `SELECT s.id, s.user_id, u.email, m.org_id, m.role
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN organization_members m ON m.user_id = u.id
       WHERE s.session_token_hash = $1 AND s.is_revoked = FALSE`,
      [tokenHash],
    );

    if (!session) {
      throw new UnauthorizedException('Session not found or already revoked');
    }

    await this.db.query(
      `UPDATE sessions SET is_locked = TRUE WHERE id = $1`,
      [session.id],
    );

    await this.audit.log({
      orgId: session.org_id || '00000000-0000-0000-0000-000000000000',
      actorId: session.user_id,
      actorEmail: session.email,
      actorRole: session.role || 'UNASSIGNED',
      action: 'SESSION_LOCK',
      resourceType: 'SESSION',
      resourceId: session.id,
      resourceName: 'Manual Session Lock',
      status: 'SUCCESS',
      details: { reason: 'User manually locked vault session' },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return { success: true, message: 'Vault session locked successfully' };
  }

  /**
   * Re-authenticates user with password to unlock a manually locked session.
   */
  async unlockSession(
    rawToken: string,
    password: string,
    meta?: RequestMetadata,
  ): Promise<{ success: boolean; user: SafeUser; membership: OrganizationMembership }> {
    const tokenHash = this.hashToken(rawToken);

    const row = await this.db.queryOne<any>(
      `SELECT s.id AS session_id, s.user_id, u.email, u.full_name, u.is_active, u.password_hash, u.totp_enabled,
              m.id AS member_id, m.org_id, m.role, m.status AS member_status, m.removed_at,
              o.name AS org_name, o.slug AS org_slug
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN organization_members m ON m.user_id = u.id
       LEFT JOIN organizations o ON o.id = m.org_id
       WHERE s.session_token_hash = $1 AND s.is_revoked = FALSE
       ORDER BY 
         CASE m.status
           WHEN 'ACTIVE' THEN 1
           WHEN 'PENDING' THEN 2
           WHEN 'REMOVED' THEN 3
           ELSE 4
         END
       LIMIT 1`,
      [tokenHash],
    );

    if (!row) {
      throw new UnauthorizedException('Session not found or revoked');
    }

    const isValid = await argon2.verify(row.password_hash, password);
    if (!isValid) {
      await this.audit.log({
        orgId: row.org_id || '00000000-0000-0000-0000-000000000000',
        actorId: row.user_id,
        actorEmail: row.email,
        actorRole: row.role || 'UNASSIGNED',
        action: 'REAUTHENTICATE',
        resourceType: 'SESSION',
        resourceId: row.session_id,
        resourceName: 'Session Unlock',
        status: 'FAILURE',
        details: { reason: 'Invalid password on unlock attempt' },
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      });
      throw new UnauthorizedException('Incorrect password');
    }

    // Unlock session and refresh activity
    await this.db.query(
      `UPDATE sessions SET is_locked = FALSE, last_activity_at = NOW() WHERE id = $1`,
      [row.session_id],
    );

    await this.audit.log({
      orgId: row.org_id || '00000000-0000-0000-0000-000000000000',
      actorId: row.user_id,
      actorEmail: row.email,
      actorRole: row.role || 'UNASSIGNED',
      action: 'REAUTHENTICATE',
      resourceType: 'SESSION',
      resourceId: row.session_id,
      resourceName: 'Session Unlock',
      status: 'SUCCESS',
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    const user: SafeUser = {
      id: row.user_id,
      email: row.email,
      full_name: row.full_name,
      name: row.full_name,
      is_active: row.is_active,
      totp_enabled: Boolean(row.totp_enabled),
    };

    const membership: OrganizationMembership = {
      id: row.member_id,
      org_id: row.org_id,
      org_name: row.org_name,
      org_slug: row.org_slug,
      role: (row.role as UserRole) || null,
      status: row.member_status || 'ACTIVE',
      removed_at: row.removed_at || null,
    };

    return { success: true, user, membership };
  }

  /**
   * Revokes session on explicit logout.
   */
  async logout(rawToken: string, meta?: RequestMetadata): Promise<void> {
    const tokenHash = this.hashToken(rawToken);

    const row = await this.db.queryOne<any>(
      `SELECT s.id AS session_id, s.user_id, u.email, m.org_id, m.role
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN organization_members m ON m.user_id = u.id
       WHERE s.session_token_hash = $1
       LIMIT 1`,
      [tokenHash],
    );

    if (row) {
      await this.db.query(
        `UPDATE sessions SET is_revoked = TRUE WHERE id = $1`,
        [row.session_id],
      );

      if (row.org_id) {
        await this.audit.log({
          orgId: row.org_id,
          actorId: row.user_id,
          actorEmail: row.email,
          actorRole: row.role || 'UNKNOWN',
          action: 'LOGOUT',
          resourceType: 'SESSION',
          resourceId: row.session_id,
          resourceName: 'User Logout',
          status: 'SUCCESS',
          ipAddress: meta?.ipAddress,
          userAgent: meta?.userAgent,
        });
      }
    }
  }
}

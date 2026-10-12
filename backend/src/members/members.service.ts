import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AuditService } from '../audit/audit.service';
import { SafeUser, UserRole } from '../auth/auth.types';

export interface MemberListItem {
  id: string;
  user_id: string;
  email: string;
  name: string;
  role: UserRole | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'REMOVED' | 'PENDING';
  joined_at: string;
  removed_at?: string | null;
  active_grants_count: number;
}

const CANONICAL_ROLES: UserRole[] = ['ADMIN', 'DEVELOPER', 'APPROVER', 'AUDITOR'];

@Injectable()
export class MembersService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Retrieves all members of the organization (ACTIVE, PENDING, REMOVED).
   */
  async getMembers(orgId: string): Promise<MemberListItem[]> {
    const sql = `
      SELECT 
        m.id, m.user_id, u.email, u.full_name AS name, m.role, m.status, m.joined_at, m.removed_at,
        COUNT(g.id) FILTER (WHERE g.status = 'ACTIVE' AND g.expires_at > NOW()) AS active_grants_count
      FROM organization_members m
      JOIN users u ON u.id = m.user_id
      LEFT JOIN temporary_grants g ON g.user_id = u.id AND g.org_id = m.org_id
      WHERE m.org_id = $1
      GROUP BY m.id, m.user_id, u.email, u.full_name, m.role, m.status, m.joined_at, m.removed_at
      ORDER BY 
        CASE m.status
          WHEN 'PENDING' THEN 1
          WHEN 'ACTIVE' THEN 2
          WHEN 'REMOVED' THEN 3
          ELSE 4
        END,
        CASE m.role
          WHEN 'ADMIN' THEN 1
          WHEN 'APPROVER' THEN 2
          WHEN 'DEVELOPER' THEN 3
          WHEN 'AUDITOR' THEN 4
          ELSE 5
        END,
        u.full_name ASC;
    `;

    const rows = await this.db.query<any>(sql, [orgId]);
    return rows.map((r) => ({
      ...r,
      role: r.role || null,
      active_grants_count: parseInt(r.active_grants_count || '0', 10),
    }));
  }

  /**
   * Approves a PENDING member and assigns a canonical role.
   */
  async approveMember(
    memberId: string,
    role: UserRole,
    actor: SafeUser,
    orgId: string,
    actorRole: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    if (!CANONICAL_ROLES.includes(role)) {
      throw new BadRequestException(`Invalid role. Must be one of: ${CANONICAL_ROLES.join(', ')}`);
    }

    const member = await this.db.queryOne<any>(
      `SELECT m.id, m.user_id, m.role, m.status, u.email, u.full_name AS name
       FROM organization_members m
       JOIN users u ON u.id = m.user_id
       WHERE m.id = $1 AND m.org_id = $2`,
      [memberId, orgId],
    );

    if (!member) {
      throw new NotFoundException('Organization member not found');
    }

    if (member.status !== 'PENDING') {
      throw new BadRequestException('Only pending members can be approved');
    }

    await this.db.query(
      `UPDATE organization_members 
       SET status = 'ACTIVE', role = $1, joined_at = NOW(), removed_at = NULL 
       WHERE id = $2`,
      [role, memberId],
    );

    // Audit approval
    await this.audit.log({
      orgId,
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole,
      action: 'MEMBER_APPROVED',
      resourceType: 'USER',
      resourceId: member.user_id,
      resourceName: member.email,
      status: 'SUCCESS',
      details: {
        assignedRole: role,
        reason: 'Administrator reviewed and approved pending member',
      },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return { success: true, memberId, role, status: 'ACTIVE' };
  }

  /**
   * Restores a REMOVED member and assigns a canonical role.
   */
  async restoreMember(
    memberId: string,
    role: UserRole,
    actor: SafeUser,
    orgId: string,
    actorRole: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    if (!CANONICAL_ROLES.includes(role)) {
      throw new BadRequestException(`Invalid role. Must be one of: ${CANONICAL_ROLES.join(', ')}`);
    }

    const member = await this.db.queryOne<any>(
      `SELECT m.id, m.user_id, m.role, m.status, u.email, u.full_name AS name
       FROM organization_members m
       JOIN users u ON u.id = m.user_id
       WHERE m.id = $1 AND m.org_id = $2`,
      [memberId, orgId],
    );

    if (!member) {
      throw new NotFoundException('Organization member not found');
    }

    if (member.status !== 'REMOVED') {
      throw new BadRequestException('Only removed members can be restored');
    }

    const previousRole = member.role;

    await this.db.query(
      `UPDATE organization_members 
       SET status = 'ACTIVE', role = $1, joined_at = NOW(), removed_at = NULL 
       WHERE id = $2`,
      [role, memberId],
    );

    // Audit restoration
    await this.audit.log({
      orgId,
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole,
      action: 'MEMBER_RESTORED',
      resourceType: 'USER',
      resourceId: member.user_id,
      resourceName: member.email,
      status: 'SUCCESS',
      details: {
        restoredRole: role,
        previousRole,
        reason: 'Administrator restored access for removed member',
      },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return { success: true, memberId, role, status: 'ACTIVE' };
  }

  /**
   * Updates a member's role (US-012).
   * Transactionally revokes all active temporary grants if role changes, and logs audit event.
   */
  async updateRole(
    memberId: string,
    newRole: UserRole,
    actor: SafeUser,
    orgId: string,
    actorRole: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    if (!CANONICAL_ROLES.includes(newRole)) {
      throw new BadRequestException(`Invalid role. Must be one of: ${CANONICAL_ROLES.join(', ')}`);
    }

    const member = await this.db.queryOne<any>(
      `SELECT m.id, m.user_id, m.role, m.status, u.email, u.full_name AS name
       FROM organization_members m
       JOIN users u ON u.id = m.user_id
       WHERE m.id = $1 AND m.org_id = $2`,
      [memberId, orgId],
    );

    if (!member) {
      throw new NotFoundException('Organization member not found');
    }

    if (member.user_id === actor.id && newRole !== 'ADMIN') {
      throw new ForbiddenException('Administrators cannot demote their own account');
    }

    // Last admin protection
    if (member.role === 'ADMIN' && newRole !== 'ADMIN') {
      const adminCountRes = await this.db.queryOne<any>(
        `SELECT COUNT(*) AS count FROM organization_members WHERE org_id = $1 AND role = 'ADMIN' AND status = 'ACTIVE'`,
        [orgId],
      );
      if (parseInt(adminCountRes?.count || '0', 10) <= 1) {
        throw new ForbiddenException('Cannot demote the last administrator in the organization');
      }
    }

    const previousRole = member.role;

    await this.db.transaction(async (client) => {
      // 1. Update role
      await client.query(
        `UPDATE organization_members SET role = $1 WHERE id = $2`,
        [newRole, memberId],
      );

      // 2. Transactionally revoke any active temporary grants for that user (US-012)
      await client.query(
        `UPDATE temporary_grants 
         SET status = 'REVOKED', revoked_at = NOW(), revoked_by = $1, 
             revocation_reason = 'Role updated to ' || $2
         WHERE user_id = $3 AND org_id = $4 AND status = 'ACTIVE'`,
        [actor.id, newRole, member.user_id, orgId],
      );
    });

    // 3. Log audit event
    await this.audit.log({
      orgId,
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole,
      action: 'PERMISSION_CHANGED',
      resourceType: 'USER',
      resourceId: member.user_id,
      resourceName: member.email,
      status: 'SUCCESS',
      details: {
        previousRole,
        newRole,
        reason: 'Administrative role reassignment; active grants revoked',
      },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return { success: true, updatedRole: newRole };
  }

  /**
   * Removes a member from the organization.
   * Marks status as REMOVED, sets removed_at, revokes active grants, invalidates active sessions, and audits the removal.
   */
  async removeMember(
    memberId: string,
    actor: SafeUser,
    orgId: string,
    actorRole: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    const member = await this.db.queryOne<any>(
      `SELECT m.id, m.user_id, m.role, m.status, u.email, u.full_name AS name
       FROM organization_members m
       JOIN users u ON u.id = m.user_id
       WHERE m.id = $1 AND m.org_id = $2`,
      [memberId, orgId],
    );

    if (!member) {
      throw new NotFoundException('Organization member not found');
    }

    if (member.user_id === actor.id) {
      throw new ForbiddenException('Administrators cannot remove their own account from the organization');
    }

    // Last admin protection
    if (member.role === 'ADMIN') {
      const adminCountRes = await this.db.queryOne<any>(
        `SELECT COUNT(*) AS count FROM organization_members WHERE org_id = $1 AND role = 'ADMIN' AND status = 'ACTIVE'`,
        [orgId],
      );
      if (parseInt(adminCountRes?.count || '0', 10) <= 1) {
        throw new ForbiddenException('Cannot remove the last administrator in the organization');
      }
    }

    await this.db.transaction(async (client) => {
      // 1. Mark status as REMOVED and record removed_at timestamp
      await client.query(
        `UPDATE organization_members SET status = 'REMOVED', removed_at = NOW() WHERE id = $1`,
        [memberId],
      );

      // 2. Revoke any active temporary grants
      await client.query(
        `UPDATE temporary_grants 
         SET status = 'REVOKED', revoked_at = NOW(), revoked_by = $1, 
             revocation_reason = 'Member removed from organization'
         WHERE user_id = $2 AND org_id = $3 AND status = 'ACTIVE'`,
        [actor.id, member.user_id, orgId],
      );

      // 3. Invalidate active sessions
      await client.query(
        `UPDATE sessions SET is_revoked = TRUE WHERE user_id = $1`,
        [member.user_id],
      );
    });

    // 4. Audit removal
    await this.audit.log({
      orgId,
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole,
      action: 'MEMBER_REMOVED',
      resourceType: 'USER',
      resourceId: member.user_id,
      resourceName: member.email,
      status: 'SUCCESS',
      details: {
        removedRole: member.role,
        reason: 'Administrator removed member from organization',
      },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return { success: true, message: 'Member removed successfully' };
  }
}

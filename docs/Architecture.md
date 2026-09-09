# SentrySafe Team Vault Architecture

## Overview

SentrySafe Team Vault is a secure centralized vault for managing sensitive credentials and secrets.

## Core Principle

Access should be intentional, limited, observable, and temporary whenever possible.

## Application Layers

### Frontend
React.js and TypeScript provide the web interface.

### Backend
Node.js and NestJS provide the REST API and business logic.

### Database
PostgreSQL stores users, roles, secret metadata, access requests, and audit records.

### Session and Temporary Access
Redis supports session and temporary-access controls.

## Security Controls

- Role-Based Access Control (RBAC)
- AES-256-GCM encryption
- Argon2id password hashing
- Secret masking
- 30-minute session timeout
- 30-minute default temporary access
- Approval workflow
- Automatic expiration
- Audit logging
- Organization/user access revocation

## Workflow

Authenticate → Request → Approve → Grant Temporary Access → Monitor → Expire/Revoke → Audit

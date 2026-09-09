# SentrySafe Team Vault Security

## Security Objectives

The system must protect sensitive credentials while ensuring access is intentional, limited, observable, and temporary.

## Access Control

The application uses Role-Based Access Control (RBAC).

Supported roles include:

- User/Developer
- Approver
- Administrator
- Auditor

## Secret Protection

Secret values must be encrypted at rest using AES-256-GCM and must remain masked unless the user has authorized temporary access.

## Temporary Access

Temporary access is approval-based and uses a 30-minute default duration.

Access must automatically expire at the configured expiration time.

## Session Security

Inactive sessions must automatically lock after 30 minutes.

## Audit Logging

Security-sensitive actions must be recorded, including:

- Access Request
- Approval
- Access Granted
- Secret Viewed
- Access Expired
- Access Revoked
- Failed Access
- Role Change

## Development Security

The project will use:

- Gitleaks
- Dependabot/npm audit
- CodeQL
- Jest
- Supertest
- Playwright
- GitHub Actions

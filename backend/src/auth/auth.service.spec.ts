import { AuthService } from './auth.service';

describe('AuthService (Unit Tests)', () => {
  let authService: AuthService;
  let mockDb: any;
  let mockAudit: any;

  beforeEach(() => {
    mockDb = {
      query: jest.fn(),
      queryOne: jest.fn(),
    };
    mockAudit = {
      log: jest.fn().mockResolvedValue({}),
    };
    authService = new AuthService(mockDb, mockAudit);
  });

  describe('hashToken', () => {
    it('should generate a 64-character hex SHA-256 hash', () => {
      const raw = 'test-token-12345678901234567890123456789012';
      const hash = authService.hashToken(raw);
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
      // Deterministic
      expect(authService.hashToken(raw)).toBe(hash);
    });
  });

  describe('hashPassword', () => {
    it('should hash a password with Argon2id', async () => {
      const hash = await authService.hashPassword('MySecurePassword123!');
      expect(hash).toContain('$argon2id$');
    });
  });

  describe('login', () => {
    it('should reject invalid credentials with UnauthorizedException', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null); // user not found

      await expect(
        authService.login(
          { email: 'nonexistent@sentrysafe.io', password: 'Password123!' },
          { ipAddress: '127.0.0.1' },
        ),
      ).rejects.toThrow('Invalid email or password');
    });

    it('should reject locked account with HttpStatus.LOCKED', async () => {
      mockDb.queryOne.mockResolvedValueOnce({
        id: 'user-1',
        email: 'locked@sentrysafe.io',
        password_hash: '$argon2id$...',
        is_active: true,
        failed_login_attempts: 5,
        locked_until: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });

      await expect(
        authService.login(
          { email: 'locked@sentrysafe.io', password: 'Password123!' },
          {},
        ),
      ).rejects.toThrow(/temporarily locked/);
    });
  });
});

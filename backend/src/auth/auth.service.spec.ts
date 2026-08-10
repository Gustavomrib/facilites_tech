import { UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { TokensService } from './tokens.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

describe('AuthService refresh', () => {
  let service: AuthService;
  let tokensService: {
    rotateRefreshToken: jest.Mock;
    revokeAllByUserId: jest.Mock;
    signAccessToken: jest.Mock;
  };
  let prisma: {
    user: { findUniqueOrThrow: jest.Mock };
  };

  beforeEach(async () => {
    tokensService = {
      rotateRefreshToken: jest.fn(),
      revokeAllByUserId: jest.fn(),
      signAccessToken: jest.fn(),
    };
    prisma = {
      user: { findUniqueOrThrow: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: TokensService, useValue: tokensService },
        { provide: AuditLogsService, useValue: { record: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  it('revokes all refresh tokens and rejects refresh for an inactive user', async () => {
    tokensService.rotateRefreshToken.mockResolvedValue({
      status: 'rotated',
      userId: 'user-1',
      rawToken: 'next-refresh-token',
      expiresAt: new Date('2026-08-10T00:00:00.000Z'),
    });
    prisma.user.findUniqueOrThrow.mockResolvedValue({
      id: 'user-1',
      companyId: 'company-1',
      role: 'STAFF',
      email: 'staff@example.com',
      isActive: false,
    });

    await expect(service.refresh('refresh-token')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(tokensService.revokeAllByUserId).toHaveBeenCalledWith('user-1');
    expect(tokensService.signAccessToken).not.toHaveBeenCalled();
  });
});

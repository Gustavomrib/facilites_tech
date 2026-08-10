import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { TokensService } from './tokens.service';
import { PrismaService } from '../prisma/prisma.service';

describe('TokensService refresh rotation', () => {
  let service: TokensService;
  let tx: {
    refreshToken: {
      findUnique: jest.Mock;
      updateMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };
  let prisma: {
    $transaction: jest.Mock;
    refreshToken: {
      updateMany: jest.Mock;
      create: jest.Mock;
    };
  };

  beforeEach(async () => {
    tx = {
      refreshToken: {
        findUnique: jest.fn(),
        updateMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    prisma = {
      $transaction: jest.fn((cb: (client: typeof tx) => unknown) => cb(tx)),
      refreshToken: {
        updateMany: jest.fn(),
        create: jest.fn(),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        TokensService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: { sign: jest.fn() } },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => (key === 'jwt.refreshExpiresIn' ? '7d' : 'secret')),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(TokensService);
  });

  it('revokes the presented token conditionally before creating the next token', async () => {
    const rawToken = 'refresh-token';
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    tx.refreshToken.findUnique.mockResolvedValue({
      id: 'token-1',
      userId: 'user-1',
      familyId: 'family-1',
      tokenHash,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    tx.refreshToken.updateMany.mockResolvedValue({ count: 1 });
    tx.refreshToken.create.mockResolvedValue({ id: 'token-2' });

    const result = await service.rotateRefreshToken(rawToken);

    expect(result.status).toBe('rotated');
    expect(tx.refreshToken.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'token-1',
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: expect.any(Date) },
      },
      data: { revokedAt: expect.any(Date) },
    });
    expect(tx.refreshToken.create).toHaveBeenCalled();
    expect(tx.refreshToken.update).toHaveBeenCalledWith({
      where: { id: 'token-1' },
      data: { replacedById: 'token-2' },
    });
  });

  it('does not create a new token when the conditional revoke affects zero rows', async () => {
    tx.refreshToken.findUnique.mockResolvedValue({
      id: 'token-1',
      userId: 'user-1',
      familyId: 'family-1',
      tokenHash: 'hash',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    tx.refreshToken.updateMany.mockResolvedValue({ count: 0 });

    const result = await service.rotateRefreshToken('refresh-token');

    expect(result.status).toBe('invalid');
    expect(tx.refreshToken.create).not.toHaveBeenCalled();
  });
});

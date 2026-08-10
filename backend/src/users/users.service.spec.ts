import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { TokensService } from '../auth/tokens.service';

describe('UsersService setActive', () => {
  let service: UsersService;
  let prisma: {
    user: { findFirst: jest.Mock; update: jest.Mock };
  };
  let tokensService: { revokeAllByUserId: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };
    tokensService = { revokeAllByUserId: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogsService, useValue: { record: jest.fn() } },
        { provide: TokensService, useValue: tokensService },
      ],
    }).compile();

    service = moduleRef.get(UsersService);
  });

  it('revokes active refresh tokens when a user is deactivated', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'user-1', role: Role.STAFF });
    prisma.user.update.mockResolvedValue({
      id: 'user-1',
      name: 'Staff',
      email: 'staff@example.com',
      role: Role.STAFF,
      isActive: false,
    });

    await service.setActive('company-1', 'admin-1', Role.ADMIN, 'user-1', false);

    expect(tokensService.revokeAllByUserId).toHaveBeenCalledWith('user-1');
  });
});

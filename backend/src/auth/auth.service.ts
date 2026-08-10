import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { TokensService } from './tokens.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from '../common/types/auth-request';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokensService: TokensService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async register(dto: RegisterDto, ip?: string) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('E-mail already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const { company, user } = await this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: { name: dto.companyName },
      });
      const user = await tx.user.create({
        data: {
          companyId: company.id,
          email: dto.email,
          passwordHash,
          name: dto.name,
          role: 'OWNER',
        },
      });
      return { company, user };
    });

    await this.auditLogsService.record({
      companyId: company.id,
      userId: user.id,
      action: 'auth.register',
      entityType: 'User',
      entityId: user.id,
    });

    return this.issueSession(user.id, user.companyId, user.role, user.email, ip);
  }

  async login(dto: LoginDto, ip?: string) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.auditLogsService.record({
      companyId: user.companyId,
      userId: user.id,
      action: 'auth.login',
      entityType: 'User',
      entityId: user.id,
    });

    return this.issueSession(user.id, user.companyId, user.role, user.email, ip);
  }

  async refresh(rawRefreshToken: string, ip?: string) {
    const result = await this.tokensService.rotateRefreshToken(rawRefreshToken, ip);

    if (result.status === 'invalid') {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: result.userId } });
    if (!user.isActive) {
      await this.tokensService.revokeAllByUserId(user.id);
      throw new UnauthorizedException('User is inactive. Please contact an administrator.');
    }

    const payload: JwtPayload = {
      sub: user.id,
      companyId: user.companyId,
      role: user.role,
      email: user.email,
    };

    return {
      accessToken: this.tokensService.signAccessToken(payload),
      refreshToken: result.rawToken!,
      refreshTokenExpiresAt: result.expiresAt!,
    };
  }

  async logout(rawRefreshToken: string): Promise<void> {
    const owner = await this.tokensService.revokeRefreshToken(rawRefreshToken);
    if (owner) {
      await this.auditLogsService.record({
        companyId: owner.companyId,
        userId: owner.userId,
        action: 'auth.logout',
        entityType: 'User',
        entityId: owner.userId,
      });
    }
  }

  private async issueSession(
    userId: string,
    companyId: string,
    role: JwtPayload['role'],
    email: string,
    ip?: string,
  ) {
    const payload: JwtPayload = { sub: userId, companyId, role, email };
    const accessToken = this.tokensService.signAccessToken(payload);
    const { rawToken, expiresAt } = await this.tokensService.issueRefreshToken(userId, ip);

    return {
      accessToken,
      refreshToken: rawToken,
      refreshTokenExpiresAt: expiresAt,
      user: { id: userId, companyId, role, email },
    };
  }
}

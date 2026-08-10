import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { randomBytes, createHash, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../common/types/auth-request';

const REFRESH_TOKEN_BYTES = 64;
type RefreshTokenClient = PrismaService | Prisma.TransactionClient;

@Injectable()
export class TokensService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  signAccessToken(payload: JwtPayload): string {
    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.accessSecret'),
      expiresIn: this.configService.get<string>('jwt.accessExpiresIn'),
    });
  }

  /** Creates a brand new refresh token family (used on register/login). */
  async issueRefreshToken(userId: string, ip?: string) {
    return this.createRefreshToken(userId, randomUUID(), ip);
  }

  /**
   * Rotates a refresh token atomically: the presented token is conditionally
   * revoked first, and the next token is only created if that update wins.
   */
  async rotateRefreshToken(rawToken: string, ip?: string) {
    const tokenHash = this.hashToken(rawToken);
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.refreshToken.findUnique({ where: { tokenHash } });

      if (!existing) {
        return { status: 'invalid' as const };
      }

      const revoked = await tx.refreshToken.updateMany({
        where: {
          id: existing.id,
          tokenHash,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: { revokedAt: now },
      });

      if (revoked.count !== 1) {
        return { status: 'invalid' as const, userId: existing.userId };
      }

      const next = await this.createRefreshToken(existing.userId, existing.familyId, ip, tx);
      await tx.refreshToken.update({
        where: { id: existing.id },
        data: { replacedById: next.record.id },
      });

      return { status: 'rotated' as const, userId: existing.userId, ...next };
    });
  }

  async revokeRefreshToken(
    rawToken: string,
  ): Promise<{ userId: string; companyId: string } | null> {
    const tokenHash = this.hashToken(rawToken);
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { companyId: true } } },
    });
    if (!existing) return null;

    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });

    return { userId: existing.userId, companyId: existing.user.companyId };
  }

  async revokeAllByUserId(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async createRefreshToken(
    userId: string,
    familyId: string,
    ip?: string,
    client: RefreshTokenClient = this.prisma,
  ) {
    const rawToken = randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = this.computeExpiry();

    const record = await client.refreshToken.create({
      data: { userId, familyId, tokenHash, expiresAt, createdByIp: ip },
    });

    return { rawToken, record, expiresAt };
  }

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  private computeExpiry(): Date {
    const raw = this.configService.get<string>('jwt.refreshExpiresIn') ?? '7d';
    const match = /^(\d+)([smhd])$/.exec(raw);
    const amount = match ? parseInt(match[1], 10) : 7;
    const unit = match ? match[2] : 'd';
    const unitMs: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
    return new Date(Date.now() + amount * (unitMs[unit] ?? unitMs.d));
  }
}

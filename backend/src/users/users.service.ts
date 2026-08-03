import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CreateUserDto } from './dto/create-user.dto';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async create(companyId: string, actingUserId: string, actingRole: Role, dto: CreateUserDto) {
    if (dto.role === Role.ADMIN && actingRole !== Role.OWNER) {
      throw new ForbiddenException('Only the owner can create ADMIN users');
    }

    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('E-mail already registered');

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: { companyId, email: dto.email, name: dto.name, role: dto.role, passwordHash },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    });

    await this.auditLogsService.record({
      companyId,
      userId: actingUserId,
      action: 'users.create',
      entityType: 'User',
      entityId: user.id,
      metadata: { role: dto.role },
    });

    return user;
  }

  findAll(companyId: string) {
    return this.prisma.user.findMany({
      where: { companyId },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async setActive(
    companyId: string,
    actingUserId: string,
    actingRole: Role,
    targetId: string,
    isActive: boolean,
  ) {
    const target = await this.prisma.user.findFirst({ where: { id: targetId, companyId } });
    if (!target) throw new NotFoundException('User not found');
    if (target.role === Role.OWNER)
      throw new ForbiddenException('The owner account cannot be deactivated');
    if (target.role === Role.ADMIN && actingRole !== Role.OWNER) {
      throw new ForbiddenException('Only the owner can manage ADMIN users');
    }

    const updated = await this.prisma.user.update({
      where: { id: targetId },
      data: { isActive },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });

    await this.auditLogsService.record({
      companyId,
      userId: actingUserId,
      action: isActive ? 'users.activate' : 'users.deactivate',
      entityType: 'User',
      entityId: targetId,
    });

    return updated;
  }
}

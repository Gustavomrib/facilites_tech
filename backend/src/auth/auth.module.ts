import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokensService } from './tokens.service';

@Module({
  imports: [JwtModule.register({}), AuditLogsModule],
  controllers: [AuthController],
  providers: [AuthService, TokensService],
  // JwtModule must be re-exported: JwtAuthGuard is registered globally via
  // APP_GUARD in AppModule and needs JwtService resolvable there — Nest's
  // module encapsulation otherwise keeps it private to AuthModule.
  exports: [TokensService, JwtModule],
})
export class AuthModule {}

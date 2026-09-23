import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PasswordResetController } from './password-reset.controller';
import { PasswordResetService } from './password-reset.service';
import { RolesGuard } from './roles.guard';

@Module({
  // Secrets/expiry are passed per-sign/verify (access and refresh use distinct
  // secrets), so the module is registered without global signing options.
  imports: [JwtModule.register({})],
  controllers: [AuthController, PasswordResetController],
  providers: [AuthService, PasswordResetService, JwtAuthGuard, RolesGuard],
  // Re-export JwtModule so modules importing AuthModule (e.g. TournamentsModule)
  // can bind JwtAuthGuard, which depends on JwtService.
  exports: [AuthService, JwtAuthGuard, JwtModule],
})
export class AuthModule {}

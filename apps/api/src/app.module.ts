import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { AuthzModule } from './authz/authz.module';
import { CentersModule } from './centers/centers.module';
import { validateEnv } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { LiveModule } from './live/live.module';
import { MatchesModule } from './matches/matches.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { RegistrationsModule } from './registrations/registrations.module';
import { ScoringModule } from './scoring/scoring.module';
import { SmsModule } from './sms/sms.module';
import { TournamentsModule } from './tournaments/tournaments.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    RedisModule,
    SmsModule,
    AuditModule,
    AuthzModule,
    NotificationsModule,
    AuthModule,
    CentersModule,
    TournamentsModule,
    RegistrationsModule,
    MatchesModule,
    ScoringModule,
    LiveModule,
    HealthModule,
  ],
})
export class AppModule {}

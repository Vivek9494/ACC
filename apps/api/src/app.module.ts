import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import { CaptainModule } from './captain/captain.module';
import { CenterSevakModule } from './center-sevak/center-sevak.module';
import { GuestModule } from './guest/guest.module';
import { PlayerModule } from './player/player.module';
import { ClubManagerModule } from './club-manager/club-manager.module';
import { AdminModule } from './admin/admin.module';
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
import { ProfileModule } from './profile/profile.module';
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
    AdminModule,
    CaptainModule,
    CenterSevakModule,
    PlayerModule,
    GuestModule,
    ClubManagerModule,
    CentersModule,
    TournamentsModule,
    RegistrationsModule,
    MatchesModule,
    ScoringModule,
    LiveModule,
    HealthModule,
    ProfileModule,
  ],
})
export class AppModule {}

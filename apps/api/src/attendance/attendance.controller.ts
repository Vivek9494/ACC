import type {
  AttendanceMonitoringView,
  AutoAttendancePunchResponse,
  PunchTimeAttendanceView,
} from '@acc/types';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthUser } from '@acc/types';
import { AttendanceService } from './attendance.service';
import { AutoAttendancePunchDto } from './dto/auto-attendance-punch.dto';
import { SetAttendancePunchDto } from './dto/set-attendance-punch.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Get('attendance/monitoring')
  monitoring(@CurrentUser() user: AuthUser): Promise<AttendanceMonitoringView> {
    return this.attendance.getMonitoringTargets(user);
  }

  @Post('matches/:matchId/attendance/auto-punch')
  autoPunch(
    @CurrentUser() user: AuthUser,
    @Param('matchId') matchId: string,
    @Body() dto: AutoAttendancePunchDto,
  ): Promise<AutoAttendancePunchResponse> {
    return this.attendance.autoPunch(
      user,
      matchId,
      dto.latitude,
      dto.longitude,
      dto.capturedAt,
    );
  }

  @Get('matches/:matchId/punch-time')
  punchTime(
    @CurrentUser() user: AuthUser,
    @Param('matchId') matchId: string,
    @Query('teamId') teamId: string,
  ): Promise<PunchTimeAttendanceView> {
    return this.attendance.getPunchTimeView(user, matchId, teamId);
  }

  @Put('matches/:matchId/attendance/:userId/punch')
  setPunch(
    @CurrentUser() user: AuthUser,
    @Param('matchId') matchId: string,
    @Param('userId') userId: string,
    @Query('teamId') teamId: string,
    @Body() dto: SetAttendancePunchDto,
  ): Promise<PunchTimeAttendanceView> {
    return this.attendance.setPunchTime(user, matchId, teamId, userId, dto.punchTimeUtc);
  }

  @Delete('matches/:matchId/attendance/:userId/punch')
  revokePunch(
    @CurrentUser() user: AuthUser,
    @Param('matchId') matchId: string,
    @Param('userId') userId: string,
    @Query('teamId') teamId: string,
  ): Promise<PunchTimeAttendanceView> {
    return this.attendance.revokePunch(user, matchId, teamId, userId);
  }

  @Post('matches/:matchId/attendance/:userId/verify')
  verifyLate(
    @CurrentUser() user: AuthUser,
    @Param('matchId') matchId: string,
    @Param('userId') userId: string,
    @Query('teamId') teamId: string,
  ): Promise<PunchTimeAttendanceView> {
    return this.attendance.verifyLatePunch(user, matchId, teamId, userId);
  }
}

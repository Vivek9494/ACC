import {
  type AuthUser,
  Permission,
  TEAM_LOGO_MAX_BYTES,
  type TeamSummary,
  type UploadTeamLogoResponse,
} from '@acc/types';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../auth/public.decorator';
import { PermissionGuard } from '../authz/permission.guard';
import { RequirePermission } from '../authz/require-permission.decorator';
import { CreateTeamDto } from './dto/create-team.dto';
import { TeamsService } from './teams.service';

/** Tournament team management (§6.3). */
@Controller()
@UseGuards(JwtAuthGuard)
export class TeamsController {
  constructor(private readonly teams: TeamsService) {}

  @Get('tournaments/:tournamentId/teams')
  @Public()
  list(@Param('tournamentId') tournamentId: string): Promise<TeamSummary[]> {
    return this.teams.list(tournamentId);
  }

  @Post('tournaments/:tournamentId/teams')
  @RequirePermission(Permission.EDIT_TOURNAMENT)
  @UseGuards(PermissionGuard)
  create(
    @CurrentUser() user: AuthUser,
    @Param('tournamentId') tournamentId: string,
    @Body() dto: CreateTeamDto,
  ): Promise<TeamSummary> {
    return this.teams.create(user, tournamentId, dto);
  }

  @Post('tournaments/team-logo')
  @UseInterceptors(FileInterceptor('logo', { limits: { fileSize: TEAM_LOGO_MAX_BYTES } }))
  async uploadLogo(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: { buffer: Buffer } | undefined,
  ): Promise<UploadTeamLogoResponse> {
    if (!file?.buffer?.length) {
      throw new BadRequestException({
        message: 'Team logo file is required',
        error: 'LOGO_REQUIRED',
      });
    }
    const logoUrl = await this.teams.uploadLogo(user, file.buffer);
    return { logoUrl };
  }
}

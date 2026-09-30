import {
  OVERLAY_THEME_HTML_MAX_BYTES,
  OVERLAY_THEME_UPLOAD_FIELD,
  UserRole,
  type AuthUser,
  type OverlayThemeDetail,
  type OverlayThemeGraphicSource,
  type OverlayThemeSummary,
} from '@acc/types';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateOverlayThemeDto, UpdateOverlayThemeDto } from './dto/overlay-theme.dto';
import { OverlayThemesService, type OverlayThemeUploadFile } from './overlay-themes.service';

/** Admin only — uploaded theme HTML is executable code. */
@Controller('admin/overlay-themes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Admin)
export class OverlayThemesController {
  constructor(private readonly themes: OverlayThemesService) {}

  @Get()
  list(): Promise<OverlayThemeSummary[]> {
    return this.themes.list();
  }

  @Post()
  create(
    @CurrentUser() actor: AuthUser,
    @Body() dto: CreateOverlayThemeDto,
  ): Promise<OverlayThemeDetail> {
    return this.themes.create(actor, dto.name);
  }

  @Get(':themeId')
  get(@Param('themeId', ParseUUIDPipe) themeId: string): Promise<OverlayThemeDetail> {
    return this.themes.get(themeId);
  }

  @Patch(':themeId')
  rename(
    @CurrentUser() actor: AuthUser,
    @Param('themeId', ParseUUIDPipe) themeId: string,
    @Body() dto: UpdateOverlayThemeDto,
  ): Promise<OverlayThemeDetail> {
    return this.themes.rename(actor, themeId, dto.name);
  }

  @Delete(':themeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() actor: AuthUser,
    @Param('themeId', ParseUUIDPipe) themeId: string,
  ): Promise<void> {
    return this.themes.remove(actor, themeId);
  }

  @Put(':themeId/graphics/:controlKey')
  @UseInterceptors(
    FileInterceptor(OVERLAY_THEME_UPLOAD_FIELD, {
      limits: { fileSize: OVERLAY_THEME_HTML_MAX_BYTES + 1, files: 1, fields: 0 },
    }),
  )
  uploadGraphic(
    @CurrentUser() actor: AuthUser,
    @Param('themeId', ParseUUIDPipe) themeId: string,
    @Param('controlKey') controlKey: string,
    @UploadedFile() file: OverlayThemeUploadFile | undefined,
  ): Promise<OverlayThemeDetail> {
    return this.themes.uploadGraphic(actor, themeId, controlKey, file);
  }

  @Delete(':themeId/graphics/:controlKey')
  removeGraphic(
    @CurrentUser() actor: AuthUser,
    @Param('themeId', ParseUUIDPipe) themeId: string,
    @Param('controlKey') controlKey: string,
  ): Promise<OverlayThemeDetail> {
    return this.themes.removeGraphic(actor, themeId, controlKey);
  }

  /** JSON-wrapped source for the sandboxed dashboard preview — never served as text/html. */
  @Get(':themeId/graphics/:controlKey/source')
  getGraphicSource(
    @Param('themeId', ParseUUIDPipe) themeId: string,
    @Param('controlKey') controlKey: string,
  ): Promise<OverlayThemeGraphicSource> {
    return this.themes.getGraphicSource(themeId, controlKey);
  }
}

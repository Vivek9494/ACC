import {
  buildOverlayThemeGraphicStorageKey,
  isOverlayThemeControlKey,
  isOverlayThemeHtmlFileName,
  isOverlayThemeHtmlMimeType,
  OVERLAY_THEME_CONTROL_KEYS,
  OVERLAY_THEME_HTML_MAX_BYTES,
  OVERLAY_THEME_HTML_MIME_TYPE,
  OVERLAY_THEME_MESSAGES,
  OVERLAY_THEME_NAME_MAX_LENGTH,
  type AuthUser,
  type OverlayThemeControlKey,
  type OverlayThemeDetail,
  type OverlayThemeGraphicSource,
  type OverlayThemeGraphicSummary,
  type OverlayThemeSummary,
} from '@acc/types';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { basename } from 'node:path';

import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { S3StorageService } from '../storage/s3-storage.service';

export interface OverlayThemeUploadFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

const FILE_NAME_MAX_LENGTH = 200;

const themeDetailInclude = {
  createdBy: { select: { firstName: true, lastName: true } },
  graphics: { orderBy: { uploadedAt: 'asc' } },
} satisfies Prisma.OverlayThemeInclude;

type ThemeDetailRow = Prisma.OverlayThemeGetPayload<{ include: typeof themeDetailInclude }>;

@Injectable()
export class OverlayThemesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: S3StorageService,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<OverlayThemeSummary[]> {
    const rows = await this.prisma.overlayTheme.findMany({
      orderBy: { createdAt: 'desc' },
      include: { graphics: { select: { controlKey: true } } },
    });
    return rows.map((row) =>
      this.toSummary(row, row.graphics.filter((g) => isOverlayThemeControlKey(g.controlKey)).length),
    );
  }

  async get(themeId: string): Promise<OverlayThemeDetail> {
    return this.toDetail(await this.requireTheme(themeId));
  }

  async create(actor: AuthUser, rawName: string): Promise<OverlayThemeDetail> {
    const name = this.normalizeName(rawName);
    await this.assertNameAvailable(name);
    try {
      const created = await this.prisma.overlayTheme.create({
        data: { name, createdById: actor.id },
        include: themeDetailInclude,
      });
      await this.audit.record({
        action: 'OVERLAY_THEME_CREATED',
        actorUserId: actor.id,
        targetEntityType: 'overlay_theme',
        targetEntityId: created.id,
        after: { name },
      });
      return this.toDetail(created);
    } catch (err) {
      throw this.mapNameConflict(err);
    }
  }

  async rename(actor: AuthUser, themeId: string, rawName: string): Promise<OverlayThemeDetail> {
    const existing = await this.requireTheme(themeId);
    const name = this.normalizeName(rawName);
    if (name === existing.name) {
      return this.toDetail(existing);
    }
    await this.assertNameAvailable(name, themeId);
    try {
      const updated = await this.prisma.overlayTheme.update({
        where: { id: themeId },
        data: { name },
        include: themeDetailInclude,
      });
      await this.audit.record({
        action: 'OVERLAY_THEME_RENAMED',
        actorUserId: actor.id,
        targetEntityType: 'overlay_theme',
        targetEntityId: themeId,
        before: { name: existing.name },
        after: { name },
      });
      return this.toDetail(updated);
    } catch (err) {
      throw this.mapNameConflict(err);
    }
  }

  async remove(actor: AuthUser, themeId: string): Promise<void> {
    const existing = await this.requireTheme(themeId);
    await this.prisma.overlayTheme.delete({ where: { id: themeId } });
    await Promise.all(
      existing.graphics.map((graphic) => this.storage.deletePrivateObject(graphic.storageKey)),
    );
    await this.audit.record({
      action: 'OVERLAY_THEME_DELETED',
      actorUserId: actor.id,
      targetEntityType: 'overlay_theme',
      targetEntityId: themeId,
      before: { name: existing.name, uploadedCount: existing.graphics.length },
    });
  }

  async uploadGraphic(
    actor: AuthUser,
    themeId: string,
    rawControlKey: string,
    file: OverlayThemeUploadFile | undefined,
  ): Promise<OverlayThemeDetail> {
    const controlKey = this.requireControlKey(rawControlKey);
    await this.requireTheme(themeId);
    const upload = this.validateHtmlFile(file);
    const storageKey = buildOverlayThemeGraphicStorageKey(themeId, controlKey);

    await this.storage.putPrivateObject({
      storageKey,
      body: upload.buffer,
      contentType: `${OVERLAY_THEME_HTML_MIME_TYPE}; charset=utf-8`,
    });

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.overlayThemeGraphic.upsert({
        where: { themeId_controlKey: { themeId, controlKey } },
        create: {
          themeId,
          controlKey,
          storageKey,
          fileName: upload.fileName,
          sizeBytes: upload.buffer.length,
          uploadedById: actor.id,
          uploadedAt: now,
        },
        update: {
          storageKey,
          fileName: upload.fileName,
          sizeBytes: upload.buffer.length,
          uploadedById: actor.id,
          uploadedAt: now,
        },
      }),
      this.prisma.overlayTheme.update({ where: { id: themeId }, data: { updatedAt: now } }),
    ]);

    await this.audit.record({
      action: 'OVERLAY_THEME_GRAPHIC_UPLOADED',
      actorUserId: actor.id,
      targetEntityType: 'overlay_theme',
      targetEntityId: themeId,
      after: { controlKey, fileName: upload.fileName, sizeBytes: upload.buffer.length },
    });

    return this.get(themeId);
  }

  async removeGraphic(
    actor: AuthUser,
    themeId: string,
    rawControlKey: string,
  ): Promise<OverlayThemeDetail> {
    const controlKey = this.requireControlKey(rawControlKey);
    const graphic = await this.requireGraphic(themeId, controlKey);
    await this.prisma.$transaction([
      this.prisma.overlayThemeGraphic.delete({ where: { id: graphic.id } }),
      this.prisma.overlayTheme.update({ where: { id: themeId }, data: { updatedAt: new Date() } }),
    ]);
    await this.storage.deletePrivateObject(graphic.storageKey);
    await this.audit.record({
      action: 'OVERLAY_THEME_GRAPHIC_REMOVED',
      actorUserId: actor.id,
      targetEntityType: 'overlay_theme',
      targetEntityId: themeId,
      before: { controlKey, fileName: graphic.fileName },
    });
    return this.get(themeId);
  }

  async getGraphicSource(
    themeId: string,
    rawControlKey: string,
  ): Promise<OverlayThemeGraphicSource> {
    const controlKey = this.requireControlKey(rawControlKey);
    const graphic = await this.requireGraphic(themeId, controlKey);
    const html = await this.storage.getPrivateObjectText(graphic.storageKey);
    return { controlKey, fileName: graphic.fileName, html };
  }

  /** Server-side gate: extension, declared content type, size, and UTF-8 text bytes. */
  validateHtmlFile(file: OverlayThemeUploadFile | undefined): {
    fileName: string;
    buffer: Buffer;
  } {
    if (!file || file.buffer.length === 0) {
      throw new BadRequestException({
        message: OVERLAY_THEME_MESSAGES.fileRequired,
        error: 'FILE_REQUIRED',
      });
    }
    const fileName = basename(file.originalname.replace(/\\/g, '/')).slice(0, FILE_NAME_MAX_LENGTH);
    if (!isOverlayThemeHtmlFileName(fileName) || !isOverlayThemeHtmlMimeType(file.mimetype)) {
      throw new BadRequestException({ message: OVERLAY_THEME_MESSAGES.fileType, error: 'FILE_TYPE' });
    }
    if (file.buffer.length > OVERLAY_THEME_HTML_MAX_BYTES) {
      throw new BadRequestException({ message: OVERLAY_THEME_MESSAGES.fileSize, error: 'FILE_SIZE' });
    }
    if (!isUtf8Text(file.buffer)) {
      throw new BadRequestException({
        message: OVERLAY_THEME_MESSAGES.fileNotText,
        error: 'FILE_NOT_TEXT',
      });
    }
    return { fileName, buffer: file.buffer };
  }

  private normalizeName(rawName: string): string {
    const name = rawName.trim();
    if (!name) {
      throw new BadRequestException({
        message: OVERLAY_THEME_MESSAGES.nameRequired,
        error: 'NAME_REQUIRED',
      });
    }
    if (name.length > OVERLAY_THEME_NAME_MAX_LENGTH) {
      throw new BadRequestException({
        message: OVERLAY_THEME_MESSAGES.nameTooLong,
        error: 'NAME_TOO_LONG',
      });
    }
    return name;
  }

  private async assertNameAvailable(name: string, excludeThemeId?: string): Promise<void> {
    const clash = await this.prisma.overlayTheme.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        ...(excludeThemeId ? { NOT: { id: excludeThemeId } } : {}),
      },
      select: { id: true },
    });
    if (clash) {
      throw new ConflictException({ message: OVERLAY_THEME_MESSAGES.nameTaken, error: 'NAME_TAKEN' });
    }
  }

  private mapNameConflict(err: unknown): unknown {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return new ConflictException({ message: OVERLAY_THEME_MESSAGES.nameTaken, error: 'NAME_TAKEN' });
    }
    return err;
  }

  private requireControlKey(value: string): OverlayThemeControlKey {
    if (!isOverlayThemeControlKey(value)) {
      throw new BadRequestException({
        message: OVERLAY_THEME_MESSAGES.unknownControl,
        error: 'UNKNOWN_CONTROL',
      });
    }
    return value;
  }

  private async requireTheme(themeId: string): Promise<ThemeDetailRow> {
    const row = await this.prisma.overlayTheme.findUnique({
      where: { id: themeId },
      include: themeDetailInclude,
    });
    if (!row) {
      throw new NotFoundException({ message: OVERLAY_THEME_MESSAGES.notFound, error: 'NOT_FOUND' });
    }
    return row;
  }

  private async requireGraphic(themeId: string, controlKey: OverlayThemeControlKey) {
    const graphic = await this.prisma.overlayThemeGraphic.findUnique({
      where: { themeId_controlKey: { themeId, controlKey } },
    });
    if (!graphic) {
      throw new NotFoundException({
        message: OVERLAY_THEME_MESSAGES.graphicNotFound,
        error: 'GRAPHIC_NOT_FOUND',
      });
    }
    return graphic;
  }

  private toSummary(
    row: { id: string; name: string; createdAt: Date; updatedAt: Date },
    uploadedCount: number,
  ): OverlayThemeSummary {
    return {
      id: row.id,
      name: row.name,
      uploadedCount,
      totalControls: OVERLAY_THEME_CONTROL_KEYS.length,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toDetail(row: ThemeDetailRow): OverlayThemeDetail {
    const graphics: OverlayThemeGraphicSummary[] = [];
    for (const graphic of row.graphics) {
      if (!isOverlayThemeControlKey(graphic.controlKey)) {
        continue;
      }
      graphics.push({
        controlKey: graphic.controlKey,
        fileName: graphic.fileName,
        sizeBytes: graphic.sizeBytes,
        uploadedAt: graphic.uploadedAt.toISOString(),
      });
    }
    return {
      ...this.toSummary(row, graphics.length),
      createdByName: `${row.createdBy.firstName} ${row.createdBy.lastName}`.trim(),
      graphics,
    };
  }
}

function isUtf8Text(buffer: Buffer): boolean {
  if (buffer.includes(0)) {
    return false;
  }
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    return true;
  } catch {
    return false;
  }
}

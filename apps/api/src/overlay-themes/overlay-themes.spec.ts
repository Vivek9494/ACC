import 'reflect-metadata';

import {
  OVERLAY_THEME_CONTROL_KEYS,
  OVERLAY_THEME_HTML_MAX_BYTES,
  OVERLAY_THEME_UPLOAD_FIELD,
  UserRole,
  type AuthUser,
} from '@acc/types';
import {
  type CanActivate,
  type ExecutionContext,
  type INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { AuditService } from '../audit/audit.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PrismaService } from '../prisma/prisma.service';
import { S3StorageService } from '../storage/s3-storage.service';
import { OverlayThemesController } from './overlay-themes.controller';
import { OverlayThemesService } from './overlay-themes.service';

const THEME_ID = '6f1c9d8e-2b3a-4c5d-9e8f-0a1b2c3d4e5f';

function user(role: UserRole): AuthUser {
  return {
    id: `${role}-1`,
    firstName: 'Test',
    lastName: role,
    mobileNumber: '+15555550001',
    email: 'test@acc.local',
    centerId: 'center-A',
    jerseyNumber: 1,
    profilePhotoUrl: null,
    role,
    isActive: true,
    teamLeadAssignments: [],
  };
}

class HeaderRoleGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: AuthUser;
    }>();
    const role = req.headers['x-test-role'];
    if (role) {
      req.user = user(role as UserRole);
    }
    return true;
  }
}

function themeRow(graphics: Array<{ controlKey: string }> = []) {
  const now = new Date('2026-09-29T12:00:00.000Z');
  return {
    id: THEME_ID,
    name: 'Night Match',
    createdById: 'ADMIN-1',
    createdAt: now,
    updatedAt: now,
    createdBy: { firstName: 'Admin', lastName: 'User' },
    graphics: graphics.map((g, i) => ({
      id: `g-${i}`,
      themeId: THEME_ID,
      controlKey: g.controlKey,
      storageKey: `overlay-themes/${THEME_ID}/${g.controlKey}.html`,
      fileName: `${g.controlKey}.html`,
      sizeBytes: 10,
      uploadedById: 'ADMIN-1',
      uploadedAt: now,
    })),
  };
}

describe('Overlay themes (Admin only)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let prisma: {
    overlayTheme: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    overlayThemeGraphic: { upsert: jest.Mock; findUnique: jest.Mock; delete: jest.Mock };
    $transaction: jest.Mock;
  };
  let storage: {
    putPrivateObject: jest.Mock;
    getPrivateObjectText: jest.Mock;
    deletePrivateObject: jest.Mock;
  };

  beforeAll(async () => {
    prisma = {
      overlayTheme: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      overlayThemeGraphic: { upsert: jest.fn(), findUnique: jest.fn(), delete: jest.fn() },
      $transaction: jest.fn(async (ops: unknown[]) => ops),
    };
    storage = {
      putPrivateObject: jest.fn().mockResolvedValue(undefined),
      getPrivateObjectText: jest.fn().mockResolvedValue('<h1>hi</h1>'),
      deletePrivateObject: jest.fn().mockResolvedValue(undefined),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [OverlayThemesController],
      providers: [
        OverlayThemesService,
        RolesGuard,
        { provide: PrismaService, useValue: prisma },
        { provide: S3StorageService, useValue: storage },
        { provide: AuditService, useValue: { record: jest.fn().mockResolvedValue(undefined) } },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(HeaderRoleGuard)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.listen(0, '127.0.0.1');
    baseUrl = `${await app.getUrl()}/admin/overlay-themes`.replace('[::1]', '127.0.0.1');
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.overlayTheme.findUnique.mockResolvedValue(themeRow());
    prisma.overlayTheme.findFirst.mockResolvedValue(null);
  });

  function htmlForm(fileName: string, type: string, body: string | Uint8Array<ArrayBuffer>): FormData {
    const form = new FormData();
    form.append(OVERLAY_THEME_UPLOAD_FIELD, new Blob([body], { type }), fileName);
    return form;
  }

  it.each([UserRole.ClubManager, UserRole.CenterSevak, UserRole.Player])(
    'returns 403 for %s on every endpoint',
    async (role) => {
      const headers = { 'x-test-role': role, 'content-type': 'application/json' };
      const responses = await Promise.all([
        fetch(baseUrl, { headers }),
        fetch(baseUrl, { method: 'POST', headers, body: JSON.stringify({ name: 'X' }) }),
        fetch(`${baseUrl}/${THEME_ID}`, { method: 'DELETE', headers }),
        fetch(`${baseUrl}/${THEME_ID}/graphics/score_strip/source`, { headers }),
        fetch(`${baseUrl}/${THEME_ID}/graphics/score_strip`, {
          method: 'PUT',
          headers: { 'x-test-role': role },
          body: htmlForm('a.html', 'text/html', '<p>x</p>'),
        }),
      ]);
      expect(responses.map((r) => r.status)).toEqual([403, 403, 403, 403, 403]);
      expect(storage.putPrivateObject).not.toHaveBeenCalled();
      expect(prisma.overlayTheme.create).not.toHaveBeenCalled();
    },
  );

  it('lists themes with the uploaded-control count for Admin', async () => {
    prisma.overlayTheme.findMany.mockResolvedValue([
      themeRow([{ controlKey: 'score_strip' }, { controlKey: 'batsman' }]),
    ]);
    const res = await fetch(baseUrl, { headers: { 'x-test-role': UserRole.Admin } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<{ uploadedCount: number; totalControls: number }>;
    expect(body[0]).toMatchObject({
      uploadedCount: 2,
      totalControls: OVERLAY_THEME_CONTROL_KEYS.length,
    });
  });

  it('rejects a duplicate theme name case-insensitively', async () => {
    prisma.overlayTheme.findFirst.mockResolvedValue({ id: 'other' });
    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'x-test-role': UserRole.Admin, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'night match' }),
    });
    expect(res.status).toBe(409);
  });

  it('stores a valid .html upload privately, keyed by theme + control', async () => {
    const res = await fetch(`${baseUrl}/${THEME_ID}/graphics/batting_card`, {
      method: 'PUT',
      headers: { 'x-test-role': UserRole.Admin },
      body: htmlForm('Batting Card.html', 'text/html', '<div>card</div>'),
    });
    expect(res.status).toBe(200);
    expect(storage.putPrivateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        storageKey: `overlay-themes/${THEME_ID}/batting_card.html`,
        contentType: 'text/html; charset=utf-8',
      }),
    );
    expect(prisma.overlayThemeGraphic.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { themeId_controlKey: { themeId: THEME_ID, controlKey: 'batting_card' } },
      }),
    );
  });

  it.each([
    ['wrong extension', 'card.htm', 'text/html', '<p>x</p>'],
    ['wrong content type', 'card.html', 'application/javascript', 'alert(1)'],
    ['script disguised as html', 'card.js', 'text/html', 'alert(1)'],
    ['binary bytes', 'card.html', 'text/html', new Uint8Array([0x3c, 0x00, 0xff, 0xfe])],
  ])('rejects %s', async (_label, fileName, type, body) => {
    const res = await fetch(`${baseUrl}/${THEME_ID}/graphics/batting_card`, {
      method: 'PUT',
      headers: { 'x-test-role': UserRole.Admin },
      body: htmlForm(fileName, type, body),
    });
    expect(res.status).toBe(400);
    expect(storage.putPrivateObject).not.toHaveBeenCalled();
  });

  it('rejects files over the size limit', async () => {
    const res = await fetch(`${baseUrl}/${THEME_ID}/graphics/batting_card`, {
      method: 'PUT',
      headers: { 'x-test-role': UserRole.Admin },
      body: htmlForm('big.html', 'text/html', 'a'.repeat(OVERLAY_THEME_HTML_MAX_BYTES + 1)),
    });
    expect([400, 413]).toContain(res.status);
    expect(storage.putPrivateObject).not.toHaveBeenCalled();
  });

  it('rejects unknown control keys', async () => {
    const res = await fetch(`${baseUrl}/${THEME_ID}/graphics/hello`, {
      method: 'PUT',
      headers: { 'x-test-role': UserRole.Admin },
      body: htmlForm('a.html', 'text/html', '<p>x</p>'),
    });
    expect(res.status).toBe(400);
  });

  it('returns preview source as JSON, not as an HTML page', async () => {
    prisma.overlayThemeGraphic.findUnique.mockResolvedValue(
      themeRow([{ controlKey: 'bowler' }]).graphics[0],
    );
    const res = await fetch(`${baseUrl}/${THEME_ID}/graphics/bowler/source`, {
      headers: { 'x-test-role': UserRole.Admin },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(await res.json()).toMatchObject({ controlKey: 'bowler', html: '<h1>hi</h1>' });
  });

  it('deletes stored files when a theme is deleted', async () => {
    prisma.overlayTheme.findUnique.mockResolvedValue(
      themeRow([{ controlKey: 'score_strip' }, { controlKey: 'fow' }]),
    );
    const res = await fetch(`${baseUrl}/${THEME_ID}`, {
      method: 'DELETE',
      headers: { 'x-test-role': UserRole.Admin },
    });
    expect(res.status).toBe(204);
    expect(prisma.overlayTheme.delete).toHaveBeenCalledWith({ where: { id: THEME_ID } });
    expect(storage.deletePrivateObject).toHaveBeenCalledTimes(2);
  });
});

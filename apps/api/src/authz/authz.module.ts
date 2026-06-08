import { Global, Module } from '@nestjs/common';

import { MatchScorerGrantService } from './match-scorer.service';
import { PermissionGuard } from './permission.guard';
import { PermissionService } from './permission.service';
import { TournamentTypeResolverService } from './tournament-type-resolver.service';

/**
 * Authorization layer (spec §1.1, §2 + RBAC matrix): the tournament-type
 * resolver, the matrix-driven permission engine, the per-match Scorer grant
 * service, and the route guard. Global so `@RequirePermission(...)` works
 * anywhere without re-importing.
 */
@Global()
@Module({
  providers: [
    TournamentTypeResolverService,
    MatchScorerGrantService,
    PermissionService,
    PermissionGuard,
  ],
  exports: [
    TournamentTypeResolverService,
    MatchScorerGrantService,
    PermissionService,
    PermissionGuard,
  ],
})
export class AuthzModule {}

import { BallType, CitySelection, TournamentType } from '@acc/types';
import { BadRequestException, Injectable } from '@nestjs/common';

/** Inputs to tournament-type resolution (ball type + scope only). */
export interface TournamentTypeInput {
  ballType: BallType;
  /** City coverage; required for tennis, ignored for leather (always ACC). */
  citySelection?: CitySelection;
}

/**
 * Resolves tournament type from ball type + scope (creator role is NOT a factor):
 *
 * - Leather Ball → ACC (scope ignored)
 * - Tennis Ball + APL → APL
 * - Tennis Ball + MULTI or SINGLE → CENTER (Center-level)
 *
 * Whether the caller may create that type is enforced separately via RBAC.
 */
@Injectable()
export class TournamentTypeResolverService {
  resolve(input: TournamentTypeInput): TournamentType {
    if (input.ballType === BallType.Leather) {
      return TournamentType.ACC;
    }

    if (!input.citySelection) {
      throw new BadRequestException({
        message: 'Tournament scope is required for tennis-ball tournaments',
        error: 'CITY_SELECTION_REQUIRED',
      });
    }

    if (input.citySelection === CitySelection.Apl) {
      return TournamentType.APL;
    }

    if (
      input.citySelection === CitySelection.Multi ||
      input.citySelection === CitySelection.Single
    ) {
      return TournamentType.Center;
    }

    throw new BadRequestException('Invalid tournament city scope');
  }
}

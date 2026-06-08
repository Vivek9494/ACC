import { BallType, CitySelection, TournamentType, UserRole } from '@acc/types';
import { BadRequestException, Injectable } from '@nestjs/common';

/** Inputs to the §1.1 type-resolution logic. */
export interface TournamentTypeInput {
  ballType: BallType;
  /** The platform-global role of the creating user (Club Manager / Center Sevak). */
  creatorRole: UserRole;
  /** City coverage chosen on the form. Ignored for Leather (ACC). */
  citySelection: CitySelection;
  /**
   * True when every active Center in the selected Province is included — either
   * via citySelection=ALL or an explicit centerIds list covering the full set.
   */
  allProvinceCentersSelected?: boolean;
}

/**
 * Resolves the tournament type from the Add Tournament inputs (spec §1.1):
 *
 * 1. Leather → ACC.
 * 2. Tennis + Club Manager + ALL cities → APL.
 * 3. Tennis + Center Sevak, OR Tennis + Club Manager with single/multi (not all)
 *    → Center-level.
 *
 * This resolves the *type* only; whether the caller may create that type is a
 * separate permission check (CREATE_ACC/APL/CENTER_TOURNAMENT).
 */
@Injectable()
export class TournamentTypeResolverService {
  resolve(input: TournamentTypeInput): TournamentType {
    if (input.ballType === BallType.Leather) {
      return TournamentType.ACC;
    }

    // Tennis ball from here.
    const allCities =
      input.citySelection === CitySelection.All || input.allProvinceCentersSelected === true;

    if (allCities) {
      if (input.creatorRole === UserRole.ClubManager || input.creatorRole === UserRole.Admin) {
        return TournamentType.APL;
      }
      // A Center Sevak choosing all cities would be APL territory, which they
      // cannot organize (§1.1, §2).
      throw new BadRequestException(
        'All-cities tennis tournaments are APL and can only be created by a Club Manager',
      );
    }

    // Tennis + proper subset (not all active Centers in the Province).
    if (
      input.creatorRole === UserRole.CenterSevak ||
      input.creatorRole === UserRole.ClubManager ||
      input.creatorRole === UserRole.Admin
    ) {
      return TournamentType.Center;
    }

    throw new BadRequestException('Only a Club Manager or Center Sevak can create a tournament');
  }
}

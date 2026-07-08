import {
  QualificationReadinessStatus,
  computeKnockoutSeeding,
  reorderQualifiedTeamsBySeedOrder,
  KnockoutManualSeedOrderError,
  KNOCKOUT_BRACKET_MESSAGES,
  KNOCKOUT_MANUAL_SEED_ERROR,
  type KnockoutSeedingResponse,
} from '@acc/types';
import { BadRequestException, Injectable } from '@nestjs/common';

import { KnockoutQualificationService } from '../knockout-qualification/knockout-qualification.service';

@Injectable()
export class KnockoutSeedingService {
  constructor(private readonly qualification: KnockoutQualificationService) {}

  async getSeeding(tournamentId: string): Promise<KnockoutSeedingResponse> {
    return this.computeForGeneration(tournamentId);
  }

  async computeForGeneration(
    tournamentId: string,
    manualTeamIds?: readonly string[],
  ): Promise<KnockoutSeedingResponse> {
    const qualification = await this.qualification.getQualification(tournamentId);

    if (qualification.status !== QualificationReadinessStatus.Ready) {
      return qualification;
    }

    let qualifiedTeams = qualification.qualifiedTeams;
    if (manualTeamIds != null && manualTeamIds.length > 0) {
      try {
        qualifiedTeams = reorderQualifiedTeamsBySeedOrder(qualifiedTeams, manualTeamIds);
      } catch (err) {
        if (err instanceof KnockoutManualSeedOrderError) {
          throw new BadRequestException({
            message: KNOCKOUT_BRACKET_MESSAGES.manualSeedInvalid,
            error: KNOCKOUT_MANUAL_SEED_ERROR,
          });
        }
        throw err;
      }
    }

    return {
      status: QualificationReadinessStatus.Ready,
      seeding: computeKnockoutSeeding({ qualifiedTeams }),
    };
  }
}

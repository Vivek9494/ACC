import { type FielderPickerResponse, type FielderPickerPlayerRow } from '@acc/types';
import { Injectable } from '@nestjs/common';

import { BowlerPickerService } from './bowler-picker.service';

/** Bowling squad rows for caught / run-out / stumped fielder selection. */
@Injectable()
export class FielderPickerService {
  constructor(private readonly bowlerPicker: BowlerPickerService) {}

  async getPicker(
    matchId: string,
    inningsId: string,
    options: { excludeBowler?: boolean } = {},
  ): Promise<FielderPickerResponse> {
    const bowlerPicker = await this.bowlerPicker.getPicker(matchId, inningsId);
    const currentBowlerId = bowlerPicker.players.find((row) => row.selected)?.userId ?? null;

    let players: FielderPickerPlayerRow[] = bowlerPicker.players.map((row) => ({
      userId: row.userId,
      firstName: row.firstName,
      lastName: row.lastName,
      profilePhotoUrl: row.profilePhotoUrl,
      isExternal: row.isExternal,
      isCurrentBowler: currentBowlerId !== null && row.userId === currentBowlerId,
    }));

    if (options.excludeBowler && currentBowlerId) {
      players = players.filter((row) => row.userId !== currentBowlerId);
    }

    return {
      matchId: bowlerPicker.matchId,
      inningsId: bowlerPicker.inningsId,
      bowlingTeamId: bowlerPicker.bowlingTeamId,
      bowlingTeamName: bowlerPicker.bowlingTeamName,
      bowlingSideIsExternal: bowlerPicker.bowlingSideIsExternal,
      currentBowlerId,
      players,
    };
  }
}

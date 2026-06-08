import 'reflect-metadata';

import { BallType, CitySelection, TournamentType, UserRole } from '@acc/types';
import { BadRequestException } from '@nestjs/common';

import { TournamentTypeResolverService } from './tournament-type-resolver.service';

describe('TournamentTypeResolverService (§1.1)', () => {
  const service = new TournamentTypeResolverService();

  it('resolves any Leather-ball tournament to ACC', () => {
    expect(
      service.resolve({
        ballType: BallType.Leather,
        creatorRole: UserRole.ClubManager,
        citySelection: CitySelection.Single,
      }),
    ).toBe(TournamentType.ACC);
  });

  it('resolves Tennis + Club Manager + ALL cities to APL', () => {
    expect(
      service.resolve({
        ballType: BallType.Tennis,
        creatorRole: UserRole.ClubManager,
        citySelection: CitySelection.All,
      }),
    ).toBe(TournamentType.APL);
  });

  it('resolves Tennis + Club Manager + full province center set to APL', () => {
    expect(
      service.resolve({
        ballType: BallType.Tennis,
        creatorRole: UserRole.ClubManager,
        citySelection: CitySelection.Multi,
        allProvinceCentersSelected: true,
      }),
    ).toBe(TournamentType.APL);
  });

  it('resolves Tennis + Center Sevak to Center-level', () => {
    expect(
      service.resolve({
        ballType: BallType.Tennis,
        creatorRole: UserRole.CenterSevak,
        citySelection: CitySelection.Multi,
      }),
    ).toBe(TournamentType.Center);
  });

  it('resolves Tennis + Club Manager + multi (not all) to Center-level', () => {
    expect(
      service.resolve({
        ballType: BallType.Tennis,
        creatorRole: UserRole.ClubManager,
        citySelection: CitySelection.Multi,
      }),
    ).toBe(TournamentType.Center);
  });

  it('rejects a Center Sevak selecting ALL cities (that would be APL)', () => {
    expect(() =>
      service.resolve({
        ballType: BallType.Tennis,
        creatorRole: UserRole.CenterSevak,
        citySelection: CitySelection.All,
      }),
    ).toThrow(BadRequestException);
  });
});

import 'reflect-metadata';

import { BallType, CitySelection, TournamentType } from '@acc/types';

import { TournamentTypeResolverService } from './tournament-type-resolver.service';

describe('TournamentTypeResolverService', () => {
  const service = new TournamentTypeResolverService();

  it('resolves Leather Ball to ACC regardless of scope', () => {
    expect(
      service.resolve({
        ballType: BallType.Leather,
      }),
    ).toBe(TournamentType.ACC);

    expect(
      service.resolve({
        ballType: BallType.Leather,
        citySelection: CitySelection.All,
      }),
    ).toBe(TournamentType.ACC);
  });

  it('resolves Tennis Ball + All the Centers to APL', () => {
    expect(
      service.resolve({
        ballType: BallType.Tennis,
        citySelection: CitySelection.All,
      }),
    ).toBe(TournamentType.APL);
  });

  it('resolves Tennis Ball + Multi-centers to CENTER', () => {
    expect(
      service.resolve({
        ballType: BallType.Tennis,
        citySelection: CitySelection.Multi,
      }),
    ).toBe(TournamentType.Center);
  });

  it('resolves Tennis Ball + single center to CENTER', () => {
    expect(
      service.resolve({
        ballType: BallType.Tennis,
        citySelection: CitySelection.Single,
      }),
    ).toBe(TournamentType.Center);
  });
});

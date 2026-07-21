import {
  BallType,
  CitySelection,
  TournamentType,
  type TournamentScopeDisplay,
} from '@acc/types';
import type { PrismaService } from '../prisma/prisma.service';

export async function provinceNameById(
  prisma: PrismaService,
  provinceId: string | null,
): Promise<string | null> {
  if (!provinceId) {
    return null;
  }
  const province = await prisma.province.findUnique({
    where: { id: provinceId },
    select: { name: true },
  });
  return province?.name ?? null;
}

/** Derives locked scope display from stored tournament For / province / center links. */
export async function buildTournamentScopeDisplay(
  prisma: PrismaService,
  tournamentId: string,
  type: TournamentType,
  ballType: BallType,
  storedProvinceId: string | null,
): Promise<TournamentScopeDisplay> {
  if (type === TournamentType.ACC || ballType === BallType.Leather) {
    return {
      citySelection: null,
      provinceName: await provinceNameById(prisma, storedProvinceId),
      centerNames: [],
    };
  }

  const links = await prisma.tournamentCenter.findMany({
    where: { tournamentId },
    include: { center: { include: { province: true } } },
    orderBy: { center: { name: 'asc' } },
  });

  const provinceName =
    (await provinceNameById(prisma, storedProvinceId)) ??
    links[0]?.center.province.name ??
    null;
  const centerNames = links.map((link) => link.center.name);
  let citySelection: CitySelection | null = CitySelection.Apl;
  if (type === TournamentType.Center) {
    citySelection = centerNames.length === 1 ? CitySelection.Single : CitySelection.Multi;
  }

  return { citySelection, provinceName, centerNames };
}

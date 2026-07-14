import { RedirectToRoleTournamentSubpage } from '../../../../../src/components/tournament/RedirectToRoleTournamentSubpage';

/** Root deep-link entry — bounce into the role Tournaments tab stack. */
export default function Route(): React.ReactElement {
  return (
    <RedirectToRoleTournamentSubpage
      subpath="teams/[teamId]/add-players"
      extraParamKeys={['teamId', 'teamName']}
    />
  );
}

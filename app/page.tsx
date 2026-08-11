import LeagueApp from "@/components/LeagueApp";
import { ROOT_LEAGUE_SLUG } from "@/lib/store";

/** The original league keeps the site root, so existing links still work. */
export default function Page() {
  return <LeagueApp slug={ROOT_LEAGUE_SLUG} />;
}

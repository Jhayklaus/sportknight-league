import LeagueApp from "@/components/LeagueApp";

export default async function LeaguePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <LeagueApp slug={slug} />;
}

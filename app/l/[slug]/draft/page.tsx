import { DraftPage } from "@/components/DraftPage";

export const metadata = { title: "Team Draft" };

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <DraftPage slug={slug} />;
}

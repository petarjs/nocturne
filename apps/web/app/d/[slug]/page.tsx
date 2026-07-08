import { DisplayView } from "@/components/display/DisplayView";

// The real display route: always a live view of one dashboard, server-owned.
export default async function DashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <DisplayView slug={slug} />;
}

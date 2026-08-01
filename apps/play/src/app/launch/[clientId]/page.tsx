import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ clientId: string }>;
};

export default async function LaunchPage({ params }: PageProps) {
  const { clientId } = await params;
  const webUrl = (process.env.WEB_URL ?? "http://localhost:3000").replace(/\/$/, "");

  redirect(`${webUrl}/launch/${encodeURIComponent(clientId)}`);
}

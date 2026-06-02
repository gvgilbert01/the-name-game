import GameLobby from "./GameLobby";

export default async function GamePage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ player?: string }>;
}) {
  const { code } = await params;
  const { player } = await searchParams;

  return <GameLobby code={code} playerId={player} />;
}
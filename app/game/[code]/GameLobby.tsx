"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Game = {
  id: string;
  code: string;
  host_player_id: string | null;
  current_chooser_player_id: string | null;
  status: string;
};

type Player = {
  id: string;
  name: string;
  score: number;
  is_host: boolean;
};

export default function GameLobby({
  code,
  playerId,
}: {
  code: string;
  playerId?: string;
}) {
  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [message, setMessage] = useState("");
  const [copyMessage, setCopyMessage] = useState("");

  async function loadLobby() {
    const { data: gameData, error: gameError } = await supabase
      .from("games")
      .select("*")
      .eq("code", code.toUpperCase())
      .single();

    if (gameError || !gameData) {
      setMessage("Game not found.");
      return;
    }

    setGame(gameData);

    const { data: playerData, error: playerError } = await supabase
      .from("players")
      .select("*")
      .eq("game_id", gameData.id)
      .order("created_at", { ascending: true });

    if (playerError) {
      setMessage(playerError.message);
      return;
    }

    setPlayers(playerData || []);
  }

  useEffect(() => {
    loadLobby();
  }, []);

  useEffect(() => {
    if (!game?.id) return;

    const channel = supabase
      .channel(`lobby-${game.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "players",
          filter: `game_id=eq.${game.id}`,
        },
        () => {
          loadLobby();
        }
      )
      .subscribe();

    const gameChannel = supabase
  .channel(`game-${game.id}`)
  .on(
    "postgres_changes",
    {
      event: "UPDATE",
      schema: "public",
      table: "games",
      filter: `id=eq.${game.id}`,
    },
    async (payload) => {
      const updatedGame = payload.new as Game;
      setGame(updatedGame);

      if (
        updatedGame.status === "round_active" ||
        updatedGame.status === "choosing_letter"
      ) {
        const { data: activeRound } = await supabase
          .from("rounds")
          .select("id")
          .eq("game_id", updatedGame.id)
          .eq("status", "active")
          .order("round_number", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (activeRound && playerId) {
          window.location.href = `/game/${code}/round?player=${playerId}`;
        }
      }
    }
  )
  .subscribe();

    return () => {
  supabase.removeChannel(channel);
  supabase.removeChannel(gameChannel);
};
  }, [game?.id, playerId, code]);

  useEffect(() => {
  if (!game?.id || !playerId) return;

  const roundChannel = supabase
    .channel(`rounds-${game.id}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "rounds",
        filter: `game_id=eq.${game.id}`,
      },
      () => {
        window.location.href = `/game/${code}/round?player=${playerId}`;
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(roundChannel);
  };
}, [game?.id, playerId, code]);

useEffect(() => {
  if (!game?.id || !playerId) return;

  const interval = window.setInterval(async () => {
    const { data: activeRound } = await supabase
      .from("rounds")
      .select("id")
      .eq("game_id", game.id)
      .eq("status", "active")
      .order("round_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeRound) {
      window.clearInterval(interval);
      window.location.href = `/game/${code}/round?player=${playerId}`;
    }
  }, 1000);

  return () => {
    window.clearInterval(interval);
  };
}, [game?.id, playerId, code]);

useEffect(() => {
  if (!game?.id) return;

  const interval = window.setInterval(async () => {
    const { data: latestGame } = await supabase
      .from("games")
      .select("*")
      .eq("id", game.id)
      .single();

    if (latestGame) {
      setGame(latestGame as Game);
    }

    const { data: latestPlayers } = await supabase
      .from("players")
      .select("*")
      .eq("game_id", game.id)
      .order("created_at", { ascending: true });

    if (latestPlayers) {
      setPlayers(latestPlayers);
    }
  }, 1000);

  return () => {
    window.clearInterval(interval);
  };
}, [game?.id]);

  const isHost = Boolean(game && playerId && game.host_player_id === playerId);

  const currentTurnPlayer = players.find(
  (player) => player.id === game?.current_chooser_player_id
);

const isCurrentTurn = Boolean(
  game && playerId && game.current_chooser_player_id === playerId
);

async function startGame() {
  if (!game) return;

  const { data, error } = await supabase
    .from("games")
    .update({
      status: "choosing_letter",
    })
    .eq("id", game.id)
    .select()
    .single();

  if (error) {
    setMessage(error.message);
    return;
  }

  setGame(data);
}

async function chooseLetter() {
  if (!game) return;

  const usedLettersResult = await supabase
    .from("rounds")
    .select("letter")
    .eq("game_id", game.id);

  const usedLetters =
    usedLettersResult.data?.map((r) => r.letter) || [];

  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  const availableLetters = alphabet.filter(
    (letter) => !usedLetters.includes(letter)
  );

  if (availableLetters.length === 0) {
    setMessage("All letters have been used.");
    return;
  }

  const letter =
    availableLetters[
      Math.floor(Math.random() * availableLetters.length)
    ];

  const roundNumber = usedLetters.length + 1;

 const { error } = await supabase
  .from("rounds")
  .insert({
    game_id: game.id,
    round_number: roundNumber,
    letter,
    status: "active",
  });

if (error) {
  setMessage(error.message);
  return;
}

await supabase
  .from("games")
  .update({ status: "round_active" })
  .eq("id", game.id);

window.location.href = `/game/${code}/round?player=${playerId}`;
}

const inviteLink =
  typeof window !== "undefined" ? `${window.location.origin}/game/${code}/join` : "";

async function shareInvite() {
  if (navigator.share) {
    await navigator.share({
      title: "The Name Game",
      text: `Join my game! Code: ${code.toUpperCase()}`,
      url: inviteLink,
    });
  } else {
    await navigator.clipboard.writeText(inviteLink);
    setCopyMessage("Invite link copied!");
    window.setTimeout(() => setCopyMessage(""), 2000);
  }
}

  return (
    <main className="min-h-screen bg-cyan-50 px-6 py-10 text-slate-900">
      <div className="mx-auto max-w-xl space-y-6">
        <section className="text-center">
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-cyan-700">
            The Name Game
          </p>
          <h1 className="mt-3 text-4xl font-black">Game Lobby</h1>
          <p className="mt-3 text-slate-600">
            Share this code with family and friends.
          </p>
        </section>

        {message ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {message}
          </div>
        ) : null}

        <section className="rounded-3xl border border-cyan-100 bg-white p-6 text-center shadow-xl shadow-cyan-100/70">
  <p className="text-sm font-bold uppercase tracking-[0.25em] text-cyan-700">
    Game Code
  </p>

  <div className="mt-3 rounded-2xl bg-cyan-50 px-4 py-5 text-4xl font-black tracking-[0.18em] text-cyan-800">
    {code.toUpperCase()}
  </div>

  <div className="mt-4 grid gap-3 sm:grid-cols-2">
    <button
  type="button"
  onClick={async () => {
    await navigator.clipboard.writeText(code.toUpperCase());
    setCopyMessage("Code copied!");
    window.setTimeout(() => setCopyMessage(""), 2000);
  }}
  className="rounded-full bg-cyan-100 px-4 py-3 text-sm font-black text-cyan-800"
>
  Copy Code
</button>

    <button
      type="button"
      onClick={shareInvite}
      className="rounded-full bg-teal-500 px-4 py-3 text-sm font-black text-white"
    >
      Share Invite
    </button>

    {copyMessage ? (
  <p className="mt-3 text-sm font-bold text-teal-700">{copyMessage}</p>
) : null}
  </div>
</section>

        <section className="rounded-3xl border border-teal-100 bg-white p-6 shadow-xl shadow-teal-100/70">
          <h2 className="text-2xl font-bold">Players</h2>

          <div className="mt-4 space-y-3">
            {players.map((player) => (
              <div
                key={player.id}
                className="flex items-center justify-between rounded-2xl bg-teal-50 px-4 py-3"
              >
                <span className="font-semibold">
                  {player.is_host ? "👑 " : "😀 "}
                  {player.name}
                </span>
                <span className="text-sm font-bold text-teal-700">
                  {player.score} pts
                </span>
              </div>
            ))}
          </div>
        </section>

{game?.status === "lobby" ? (
  <section className="rounded-3xl border border-cyan-100 bg-white p-6 text-center shadow-xl shadow-cyan-100/70">
    {isHost ? (
      <button
        type="button"
        onClick={startGame}
        className="w-full rounded-2xl bg-cyan-600 px-4 py-3 font-bold text-white shadow-lg shadow-cyan-200 transition hover:bg-cyan-700"
      >
        Start Game
      </button>
    ) : (
      <p className="font-semibold text-slate-600">
        Waiting for host to start...
      </p>
    )}
  </section>
) : (
  <section className="rounded-3xl border border-cyan-100 bg-white p-6 text-center shadow-xl shadow-cyan-100/70">
    <h3 className="text-xl font-bold text-cyan-700">Current Turn</h3>

<p className="mt-2 font-semibold text-slate-700">
  {currentTurnPlayer?.name || "Waiting..."}
</p>

{isCurrentTurn ? (
  <>
    <p className="mt-3 text-slate-600">
      Game started. Choose a letter to begin the round.
    </p>

    <button
      type="button"
      onClick={chooseLetter}
      className="mt-4 w-full rounded-full bg-teal-500 px-4 py-4 text-lg font-black tracking-wide text-white shadow-[0_8px_0_#0f766e] transition-all hover:translate-y-[2px] hover:shadow-[0_6px_0_#0f766e] active:translate-y-[4px] active:shadow-[0_4px_0_#0f766e]"
    >
      🔤 CHOOSE LETTER
    </button>
  </>
) : (
  <p className="mt-3 text-slate-600">
    Game started. Waiting for {currentTurnPlayer?.name || "the current player"}{" "}
    to choose a letter...
  </p>
)}
  </section>
)}
      </div>
    </main>
  );
}
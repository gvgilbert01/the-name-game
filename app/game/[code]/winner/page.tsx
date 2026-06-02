"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useParams } from "next/navigation";

type Player = {
  id: string;
  name: string;
  score: number;
};

export default function WinnerPage() {
  const params = useParams<{ code: string }>();
  const code = params.code;

  const [players, setPlayers] = useState<Player[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadWinners() {
      const { data: game } = await supabase
        .from("games")
        .select("id")
        .eq("code", code.toUpperCase())
        .single();

      if (!game) {
        setMessage("Game not found.");
        return;
      }

      const { data: playerData } = await supabase
        .from("players")
        .select("id, name, score")
        .eq("game_id", game.id)
        .order("score", { ascending: false });

      setPlayers(playerData || []);
    }

    loadWinners();
  }, [code]);

  return (
    <main className="min-h-screen bg-cyan-50 px-6 py-10 text-slate-900">
      <div className="mx-auto max-w-xl space-y-6">
        <section className="text-center">
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-cyan-700">
            The Name Game
          </p>
          <h1 className="mt-3 text-4xl font-black">🏆 Winner</h1>
        </section>

        {message ? (
          <div className="rounded-2xl bg-white p-4 text-center font-bold text-red-600">
            {message}
          </div>
        ) : null}

        <section className="rounded-3xl border border-cyan-100 bg-white p-6 shadow-xl shadow-cyan-100/70">
          <div className="space-y-3">
            {players.map((player, index) => (
              <div
                key={player.id}
                className="flex items-center justify-between rounded-2xl bg-cyan-50 px-4 py-4"
              >
                <span className="font-black">
                  {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "🎮"}{" "}
                  {player.name}
                </span>
                <span className="font-black text-cyan-800">
                  {player.score} pts
                </span>
              </div>
            ))}
          </div>
        </section>

        <a
          href="/"
          className="block rounded-full bg-teal-500 px-4 py-4 text-center text-lg font-black tracking-wide text-white shadow-[0_8px_0_#0f766e]"
        >
          Play Again
        </a>
      </div>
    </main>
  );
}
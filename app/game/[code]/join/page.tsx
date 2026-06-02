"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function JoinGamePage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();

  const code = params.code.toUpperCase();

  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function joinGame() {
    if (!name.trim()) {
      setMessage("Enter your name.");
      return;
    }

    setLoading(true);

    const { data: game } = await supabase
      .from("games")
      .select("id")
      .eq("code", code)
      .single();

    if (!game) {
      setMessage("Game not found.");
      setLoading(false);
      return;
    }

    const { data: player, error } = await supabase
      .from("players")
      .insert({
        game_id: game.id,
        name: name.trim(),
        score: 0,
        is_host: false,
      })
      .select()
      .single();

    if (error || !player) {
      setMessage(error?.message || "Could not join game.");
      setLoading(false);
      return;
    }

    router.push(
      `/game/${code}?player=${player.id}`
    );
  }

  return (
    <main className="min-h-screen bg-cyan-50 px-6 py-10">
      <div className="mx-auto max-w-md">
        <div className="rounded-3xl bg-white p-6 shadow-xl">
          <h1 className="text-center text-3xl font-black text-cyan-800">
            Join Game
          </h1>

          <p className="mt-2 text-center text-slate-600">
            Code: {code}
          </p>

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="mt-6 w-full rounded-2xl border px-4 py-3"
          />

          <button
            type="button"
            onClick={joinGame}
            disabled={loading}
            className="mt-4 w-full rounded-full bg-teal-500 px-4 py-4 font-black text-white"
          >
            Join Game
          </button>

          {message ? (
            <p className="mt-4 text-center text-red-600">
              {message}
            </p>
          ) : null}
        </div>
      </div>
    </main>
  );
}
"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

function makeGameCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export default function Home() {
  const [hostName, setHostName] = useState("");
  const [joinName, setJoinName] = useState("");
  const [gameCode, setGameCode] = useState("");
  const [message, setMessage] = useState("");

  async function createGame() {
    setMessage("");

    if (!hostName.trim()) {
      setMessage("Enter your name first.");
      return;
    }

    const code = makeGameCode();

    const { data: game, error: gameError } = await supabase
      .from("games")
      .insert({ code, status: "lobby" })
      .select()
      .single();

    if (gameError) {
      setMessage(gameError.message);
      return;
    }

    const { data: player, error: playerError } = await supabase
      .from("players")
      .insert({
        game_id: game.id,
        name: hostName.trim(),
        is_host: true,
      })
      .select()
      .single();

    if (playerError) {
      setMessage(playerError.message);
      return;
    }

    await supabase
  .from("games")
  .update({
    host_player_id: player.id,
    current_chooser_player_id: player.id,
  })
  .eq("id", game.id);

    window.location.href = `/game/${code}?player=${player.id}`;
  }

  async function joinGame() {
    setMessage("");

    if (!joinName.trim() || !gameCode.trim()) {
      setMessage("Enter your name and game code.");
      return;
    }

    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("*")
      .eq("code", gameCode.trim().toUpperCase())
      .single();

    if (gameError || !game) {
      setMessage("Game not found.");
      return;
    }

    const { data: player, error: playerError } = await supabase
      .from("players")
      .insert({
        game_id: game.id,
        name: joinName.trim(),
        is_host: false,
      })
      .select()
      .single();

    if (playerError) {
      setMessage(playerError.message);
      return;
    }

    window.location.href = `/game/${game.code}?player=${player.id}`;
  }

  return (
    <main className="min-h-screen bg-cyan-50 px-6 py-10 text-slate-900">
      <div className="mx-auto max-w-xl space-y-7">
        <section className="text-center">
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-cyan-700">
            Family Word Game
          </p>
          <h1 className="mt-4 text-5xl font-black tracking-tight">
            The Name Game
          </h1>
          <p className="mt-4 text-slate-600">
            Name. Animal. Place. Thing. Pick a letter, think fast, and have fun.
          </p>
        </section>

        {message ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {message}
          </div>
        ) : null}

        <section className="rounded-3xl border border-cyan-100 bg-white p-6 shadow-xl shadow-cyan-100/70">
          <h2 className="text-2xl font-bold">Create a Game</h2>
          <p className="mt-1 text-sm text-slate-600">
            Start a new game and receive a game code to share with family and
            friends.
          </p>

          <input
            value={hostName}
            onChange={(e) => setHostName(e.target.value)}
            placeholder="Your name"
            className="mt-5 w-full rounded-2xl border border-cyan-200 bg-cyan-50/40 px-4 py-3 outline-none focus:border-cyan-600"
          />

          <button
            onClick={createGame}
            className="mt-4 w-full rounded-2xl bg-cyan-600 px-4 py-3 font-bold text-white shadow-lg shadow-cyan-200 transition hover:bg-cyan-700"
          >
            Create Game
          </button>
        </section>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-cyan-200" />
          <span className="rounded-full bg-white px-4 py-2 text-sm font-bold text-cyan-700 shadow-sm">
            OR
          </span>
          <div className="h-px flex-1 bg-cyan-200" />
        </div>

        <section className="rounded-3xl border border-teal-100 bg-white p-6 shadow-xl shadow-teal-100/70">
          <h2 className="text-2xl font-bold">Join a Game</h2>
          <p className="mt-1 text-sm text-slate-600">
            Enter the game code provided by the host.
          </p>

          <input
            value={joinName}
            onChange={(e) => setJoinName(e.target.value)}
            placeholder="Your name"
            className="mt-5 w-full rounded-2xl border border-teal-200 bg-teal-50/40 px-4 py-3 outline-none focus:border-teal-600"
          />

          <input
            value={gameCode}
            onChange={(e) => setGameCode(e.target.value)}
            placeholder="Game code"
            className="mt-3 w-full rounded-2xl border border-teal-200 bg-teal-50/40 px-4 py-3 uppercase outline-none focus:border-teal-600"
          />

          <button
            onClick={joinGame}
            className="mt-4 w-full rounded-2xl bg-teal-500 px-4 py-3 font-bold text-white shadow-lg shadow-teal-200 transition hover:bg-teal-600"
          >
            Join Game
          </button>
        </section>
      </div>
    </main>
  );
}
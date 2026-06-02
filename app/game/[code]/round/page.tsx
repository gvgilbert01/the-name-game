"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useParams, useSearchParams } from "next/navigation";

type Round = {
  id: string;
  game_id: string;
  round_number: number;
  letter: string;
  status: string;
  done_at: string | null;
  done_player_id: string | null;
  countdown_end_at: string | null;
  scores_saved: boolean;
};

type Player = {
  id: string;
  name: string;
  score: number;
  is_host: boolean;
};

type Answer = {
  id: string;
  round_id: string;
  player_id: string;
  category: string;
  answer: string | null;
  status: string;
  challenged_by: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
};

const categories = ["Name", "Animal", "Place", "Thing"];

function normalizeAnswer(answer: string | null) {
  return answer?.trim().toLowerCase() || "";
}

export default function RoundPage() {
  const params = useParams<{ code: string }>();
  const searchParams = useSearchParams();
  const playerId = searchParams.get("player");
  const code = params.code;

  const [round, setRound] = useState<Round | null>(null);
  const [gameId, setGameId] = useState("");

  const [nameAnswer, setNameAnswer] = useState("");
  const [animalAnswer, setAnimalAnswer] = useState("");
  const [placeAnswer, setPlaceAnswer] = useState("");
  const [thingAnswer, setThingAnswer] = useState("");

  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  const [players, setPlayers] = useState<Player[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [hostPlayerId, setHostPlayerId] = useState<string | null>(null);
  const [currentChooserPlayerId, setCurrentChooserPlayerId] = useState<string | null>(null);

  const roundLocked = round?.status === "done_countdown" && countdown === 0;
  const showReveal = roundLocked;

  useEffect(() => {
    async function loadRound() {
      const { data: game, error: gameError } = await supabase
        .from("games")
        .select("id, host_player_id, current_chooser_player_id")
        .eq("code", code.toUpperCase())
        .single();

      if (gameError || !game) {
        setMessage("Game not found.");
        return;
      }

      setGameId(game.id);

      setHostPlayerId(game.host_player_id);
      setCurrentChooserPlayerId(game.current_chooser_player_id);

      const { data: roundData, error: roundError } = await supabase
        .from("rounds")
        .select("*")
        .eq("game_id", game.id)
        .in("status", ["active", "done_countdown"])
        .order("round_number", { ascending: false })
        .limit(1)
        .single();

      if (roundError || !roundData) {
        setMessage("No active round found.");
        return;
      }

      setRound(roundData);
    }

    loadRound();
  }, [code]);

  useEffect(() => {
    if (!round?.id) return;

    const interval = window.setInterval(async () => {
      const { data } = await supabase
        .from("rounds")
        .select("*")
        .eq("id", round.id)
        .single();

      if (data) {
        setRound(data);
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, [round?.id]);

  useEffect(() => {
    if (!round?.countdown_end_at) return;

    const tick = () => {
      const remaining = Math.ceil(
        (new Date(round.countdown_end_at!).getTime() - Date.now()) / 1000
      );

      setCountdown(remaining <= 0 ? 0 : remaining);
    };

    tick();

    const interval = window.setInterval(tick, 250);

    return () => window.clearInterval(interval);
  }, [round?.countdown_end_at]);

  async function saveAnswers(startCountdown: boolean) {
    if (!round || !playerId || submitted) return;

    const { data: existingAnswers } = await supabase
      .from("answers")
      .select("id")
      .eq("round_id", round.id)
      .eq("player_id", playerId);

    if (existingAnswers && existingAnswers.length > 0) {
      setSubmitted(true);
      return;
    }

    const answerRows = [
      { category: "Name", answer: nameAnswer.trim() },
      { category: "Animal", answer: animalAnswer.trim() },
      { category: "Place", answer: placeAnswer.trim() },
      { category: "Thing", answer: thingAnswer.trim() },
    ];

    const { error } = await supabase.from("answers").insert(
      answerRows.map((item) => ({
        round_id: round.id,
        player_id: playerId,
        category: item.category,
        answer: item.answer,
        points: 0,
      }))
    );

    if (error) {
      setMessage(error.message);
      return;
    }

    setSubmitted(true);

    if (startCountdown) {
      const countdownEnd = new Date(Date.now() + 5000).toISOString();

      const { error: roundError } = await supabase
        .from("rounds")
        .update({
          done_player_id: playerId,
          done_at: new Date().toISOString(),
          countdown_end_at: countdownEnd,
          status: "done_countdown",
        })
        .eq("id", round.id)
        .is("done_player_id", null);

      if (roundError) {
        setMessage(roundError.message);
        return;
      }

      setMessage("Answers submitted! Countdown started.");
    } else {
      setMessage("Answers saved.");
    }
  }

  async function submitAnswers() {
    await saveAnswers(true);
  }

  useEffect(() => {
    if (!roundLocked || submitted) return;

    saveAnswers(false);
  }, [roundLocked, submitted]);

  useEffect(() => {
  if (!round?.id || !playerId) return;

  if (round.status === "completed") {
    window.location.href = `/game/${code}?player=${playerId}`;
  }
}, [round?.status, round?.id, playerId, code]);

  useEffect(() => {
    if (!showReveal || !round?.id || !gameId) return;

    async function loadRevealData() {
      const { data: playerData } = await supabase
        .from("players")
        .select("*")
        .eq("game_id", gameId)
        .order("created_at", { ascending: true });

      const { data: answerData } = await supabase
        .from("answers")
        .select("*")
        .eq("round_id", round!.id);

      setPlayers(playerData || []);
      setAnswers(answerData || []);
    }

    loadRevealData();

    const interval = window.setInterval(loadRevealData, 1000);

    return () => window.clearInterval(interval);
  }, [showReveal, round?.id, gameId]);

  function getAnswerForPlayer(playerIdToFind: string, category: string) {
    return answers.find(
      (answer) =>
        answer.player_id === playerIdToFind && answer.category === category
    );
  }

function getPoints(answer: Answer | undefined) {
  if (!answer || answer.status === "rejected") return 0;

  const value = normalizeAnswer(answer.answer || "");

  if (!value) return 0;

  const roundLetter = round?.letter?.toLowerCase();

  if (roundLetter && !value.startsWith(roundLetter)) {
    return 0;
  }

  const sameCategoryMatches = answers.filter(
    (item) =>
      item.status !== "rejected" &&
      item.category === answer.category &&
      normalizeAnswer(item.answer) === value
  );

  return sameCategoryMatches.length > 1 ? 5 : 10;
}

  function getPlayerRoundScore(playerIdToFind: string) {
    return categories.reduce((total, category) => {
      const answer = getAnswerForPlayer(playerIdToFind, category);
      return total + getPoints(answer);
    }, 0);
  }

 function openDictionary(word: string | null) {
  if (!word) return;

  window.open(
    `https://www.merriam-webster.com/dictionary/${encodeURIComponent(word)}`,
    "_blank"
  );
} 

async function saveRoundScores() {
  if (!round || !players.length) return;

  const hasUnresolvedChallenges = answers.some(
    (answer) => answer.status === "challenged"
  );

  if (hasUnresolvedChallenges) {
    setMessage("Review all challenged answers before saving scores.");
    return;
  }

  if (round.scores_saved) {
    setMessage("Scores already saved.");
    return;
  }

  for (const player of players) {
    const roundScore = getPlayerRoundScore(player.id);

    const { error } = await supabase
      .from("players")
      .update({
        score: player.score + roundScore,
      })
      .eq("id", player.id);

    if (error) {
      setMessage(error.message);
      return;
    }
  }

  const { data, error } = await supabase
    .from("rounds")
    .update({ scores_saved: true })
    .eq("id", round.id)
    .select()
    .single();

  if (error) {
    setMessage(error.message);
    return;
  }

  setRound(data);
  setMessage("Scores saved!");
}

async function goToNextRound() {
  if (!round || !gameId || !round.scores_saved) {
    setMessage("Save scores before starting the next round.");
    return;
  }

  const { data: allPlayers, error: playersError } = await supabase
    .from("players")
    .select("*")
    .eq("game_id", gameId)
    .order("created_at", { ascending: true });

  if (playersError || !allPlayers?.length) {
    setMessage("Could not load players.");
    return;
  }

  const currentIndex = allPlayers.findIndex(
    (player) => player.id === currentChooserPlayerId
  );

  const nextIndex =
    currentIndex >= 0 ? (currentIndex + 1) % allPlayers.length : 0;

  const nextPlayer = allPlayers[nextIndex];

  await supabase
    .from("rounds")
    .update({ status: "completed" })
    .eq("id", round.id);

  await supabase
    .from("games")
    .update({
      status: "choosing_letter",
      current_chooser_player_id: nextPlayer.id,
    })
    .eq("id", gameId);

  window.location.href = `/game/${code}?player=${playerId}`;
}

async function endGame() {
  if (!gameId) return;

  await supabase
    .from("games")
    .update({ status: "completed" })
    .eq("id", gameId);

  window.location.href = `/game/${code}/winner?player=${playerId}`;
}

const isHost = Boolean(playerId && hostPlayerId === playerId);

async function challengeAnswer(answerId: string) {
  if (!playerId) {
    setMessage("Missing player ID.");
    return;
  }

  console.log("Challenging answer:", answerId, "by player:", playerId);

  const { data, error } = await supabase
    .from("answers")
    .update({
      challenged: true,
      status: "challenged",
      challenged_by: playerId,
    })
    .eq("id", answerId)
    .select("*")
    .single();

  console.log("Challenge result:", { data, error });

  if (error) {
    setMessage(error.message);
    return;
  }

  if (!data) {
    setMessage("No answer was updated.");
    return;
  }

  setAnswers((current) =>
    current.map((answer) => (answer.id === answerId ? data : answer))
  );

  setMessage("Answer challenged.");
}

async function reviewAnswer(answerId: string, status: "accepted" | "rejected") {
  if (!playerId) return;

  const { error } = await supabase
    .from("answers")
    .update({
      status,
      reviewed_by: playerId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", answerId);

  if (error) {
    setMessage(error.message);
    return;
  }

  setMessage(status === "accepted" ? "Answer accepted." : "Answer rejected.");
}

  return (
    <main className="min-h-screen bg-cyan-50 px-6 py-10 text-slate-900">
      <div className="mx-auto max-w-xl space-y-6">
        <section className="text-center">
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-cyan-700">
            The Name Game
          </p>
          <h1 className="mt-3 text-4xl font-black">
            Round {round?.round_number || "..."}
          </h1>
        </section>

        {message && !showReveal ? (
          <div className="rounded-2xl border border-cyan-200 bg-white p-4 text-center text-sm font-semibold text-cyan-700 shadow">
            {message}
          </div>
        ) : null}

        <section className="rounded-3xl border border-cyan-100 bg-white p-6 text-center shadow-xl shadow-cyan-100/70">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-cyan-700">
            Letter
          </p>
          <div className="mt-3 rounded-2xl bg-cyan-50 px-4 py-6 text-7xl font-black tracking-[0.18em] text-cyan-800">
            {round?.letter || "?"}
          </div>
        </section>

        {countdown !== null && !showReveal ? (
          <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-center shadow">
            <h3 className="text-2xl font-bold text-amber-700">
              Someone finished!
            </h3>

            <div className="mt-3 text-6xl font-black text-amber-800">
              {countdown}
            </div>
          </section>
        ) : null}

        {showReveal ? (
          <section className="rounded-3xl border border-teal-100 bg-white p-6 shadow-xl shadow-teal-100/70">
            <h2 className="text-center text-3xl font-black text-cyan-800">
              Reveal Answers
            </h2>
            <p className="mt-2 text-center text-sm text-slate-600">
              Unique correct answers get 10 points. Duplicate answers get 5.
              Blank answers get 0.
            </p>

           <div className="mt-6 overflow-x-auto rounded-2xl border border-cyan-100">
  <table className="w-full min-w-[640px] border-collapse bg-white text-sm">
    <thead className="bg-cyan-100 text-cyan-900">
      <tr>
        <th className="px-3 py-3 text-left font-black">Player</th>
        {categories.map((category) => (
          <th key={category} className="px-3 py-3 text-left font-black">
            {category}
          </th>
        ))}
        <th className="px-3 py-3 text-right font-black">Score</th>
      </tr>
    </thead>

    <tbody>
      {players.map((player) => (
        <tr key={player.id} className="border-t border-cyan-100">
          <td className="px-3 py-3 font-bold">{player.name}</td>

          {categories.map((category) => {
            const answer = getAnswerForPlayer(player.id, category);
            const points = getPoints(answer);

            return (
              <td key={category} className="px-3 py-3">
                <div className="font-semibold text-slate-800">
  {answer?.answer || "—"}
</div>

<div className="font-semibold text-slate-800">
  {answer?.answer || "—"}
</div>

{answer?.status === "challenged" ? (
  <div className="mt-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-black text-amber-700">
    ⚠ Challenged
  </div>
) : null}

{isHost && answer?.answer ? (
  <button
    type="button"
    onClick={() => openDictionary(answer.answer)}
    title="Check dictionary"
    className="mt-1 inline-flex rounded-full bg-cyan-50 px-2 py-1 text-xs font-bold text-cyan-700 hover:bg-cyan-100"
  >
    📖
  </button>
) : null}

{answer?.answer ? (
  <>
    {answer.status === "challenged" ? (
      <div className="mt-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-black text-amber-700">
        ⚠ Challenged
      </div>
    ) : null}

    <div className="mt-2 flex flex-wrap gap-1">
      {!isHost ? (
        <button
          type="button"
          onClick={() => challengeAnswer(answer.id)}
          disabled={answer.status === "challenged"}
          className="rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700 hover:bg-amber-100 disabled:opacity-50"
        >
          {answer.status === "challenged" ? "Challenged" : "Challenge"}
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={() => reviewAnswer(answer.id, "accepted")}
            className="rounded-full bg-teal-50 px-2 py-1 text-xs font-bold text-teal-700 hover:bg-teal-100"
          >
            ✓
          </button>

          <button
            type="button"
            onClick={() => reviewAnswer(answer.id, "rejected")}
            className="rounded-full bg-red-50 px-2 py-1 text-xs font-bold text-red-700 hover:bg-red-100"
          >
            ✕
          </button>
        </>
      )}
    </div>
  </>
) : null}

                <div className="text-xs font-bold text-teal-700">
                  {points} pts
                </div>
              </td>
            );
          })}

          <td className="px-3 py-3 text-right font-black text-teal-700">
            {getPlayerRoundScore(player.id)} pts
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>  

{isHost ? (
  <>
    <button
      type="button"
      onClick={saveRoundScores}
      disabled={round?.scores_saved}
      className="mt-6 w-full rounded-full bg-cyan-600 px-4 py-4 text-lg font-black tracking-wide text-white shadow-[0_8px_0_#0e7490] transition-all hover:translate-y-[2px] hover:shadow-[0_6px_0_#0e7490] active:translate-y-[4px] active:shadow-[0_4px_0_#0e7490] disabled:cursor-not-allowed disabled:bg-slate-400 disabled:shadow-[0_8px_0_#64748b]"
    >
      {round?.scores_saved ? "SCORES SAVED" : "Save Scores"}
    </button>

    <button
      type="button"
      onClick={goToNextRound}
      className="mt-4 w-full rounded-full bg-teal-500 px-4 py-4 text-lg font-black tracking-wide text-white shadow-[0_8px_0_#0f766e] transition-all hover:translate-y-[2px] hover:shadow-[0_6px_0_#0f766e] active:translate-y-[4px] active:shadow-[0_4px_0_#0f766e]"
    >
      Next Round
    </button>

    <button
  type="button"
  onClick={endGame}
  className="mt-4 w-full rounded-full bg-slate-700 px-4 py-4 text-lg font-black tracking-wide text-white shadow-[0_8px_0_#334155] transition-all hover:translate-y-[2px] hover:shadow-[0_6px_0_#334155] active:translate-y-[4px] active:shadow-[0_4px_0_#334155]"
>
  End Game
</button>
  </>
) : (
  <p className="mt-6 rounded-2xl bg-cyan-50 p-4 text-center font-semibold text-cyan-800">
    Waiting for host to save scores and start the next round...
  </p>
)}
            </section>
        ) : (
          <section className="rounded-3xl border border-teal-100 bg-white p-6 shadow-xl shadow-teal-100/70">
            <div className="space-y-4">
              <input
                disabled={roundLocked}
                value={nameAnswer}
                onChange={(e) => setNameAnswer(e.target.value)}
                placeholder="Name"
                className="w-full rounded-2xl border border-teal-200 bg-teal-50/40 px-4 py-3 outline-none focus:border-teal-600 disabled:bg-slate-100"
              />

              <input
                disabled={roundLocked}
                value={animalAnswer}
                onChange={(e) => setAnimalAnswer(e.target.value)}
                placeholder="Animal"
                className="w-full rounded-2xl border border-teal-200 bg-teal-50/40 px-4 py-3 outline-none focus:border-teal-600 disabled:bg-slate-100"
              />

              <input
                disabled={roundLocked}
                value={placeAnswer}
                onChange={(e) => setPlaceAnswer(e.target.value)}
                placeholder="Place"
                className="w-full rounded-2xl border border-teal-200 bg-teal-50/40 px-4 py-3 outline-none focus:border-teal-600 disabled:bg-slate-100"
              />

              <input
                disabled={roundLocked}
                value={thingAnswer}
                onChange={(e) => setThingAnswer(e.target.value)}
                placeholder="Thing"
                className="w-full rounded-2xl border border-teal-200 bg-teal-50/40 px-4 py-3 outline-none focus:border-teal-600 disabled:bg-slate-100"
              />

              <button
                type="button"
                onClick={submitAnswers}
                disabled={submitted || roundLocked}
                className="w-full rounded-full bg-teal-500 px-4 py-4 text-lg font-black tracking-wide text-white shadow-[0_8px_0_#0f766e] transition-all hover:translate-y-[2px] hover:shadow-[0_6px_0_#0f766e] active:translate-y-[4px] active:shadow-[0_4px_0_#0f766e] disabled:cursor-not-allowed disabled:bg-slate-400 disabled:shadow-[0_8px_0_#64748b]"
              >
                {roundLocked ? "ROUND CLOSED" : submitted ? "SUBMITTED" : "DONE"}
              </button>
            </div>      

          </section>
        )}
      </div>
    </main>
  );
}
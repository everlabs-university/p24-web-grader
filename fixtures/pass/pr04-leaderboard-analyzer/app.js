'use strict';

function analyzeLeaderboard(players) {
  const valid = Array.isArray(players)
    && players.length > 0
    && players.every((player) => player
      && typeof player.name === 'string'
      && player.name.trim() !== ''
      && Array.isArray(player.scores)
      && player.scores.length > 0
      && player.scores.every((score) => Number.isInteger(score) && score >= 0 && score <= 100));

  if (!valid) return { ok: false, message: 'Invalid leaderboard data.' };

  const analyzedPlayers = players
    .map((player) => {
      const scores = [...player.scores];
      const total = scores.reduce((sum, score) => sum + score, 0);
      return {
        name: player.name,
        scores,
        total,
        average: Math.round((total / scores.length) * 10) / 10,
        best: Math.max(...scores),
      };
    })
    .sort((left, right) => right.average - left.average
      || right.best - left.best
      || left.name.localeCompare(right.name));

  const rankedPlayers = analyzedPlayers.map((player, index) => ({ ...player, rank: index + 1 }));
  const allScores = players.flatMap(({ scores }) => scores);
  const classAverage = Math.round((allScores.reduce((sum, score) => sum + score, 0) / allScores.length) * 10) / 10;

  return {
    ok: true,
    players: rankedPlayers,
    summary: {
      playerCount: rankedPlayers.length,
      classAverage,
      highestScore: Math.max(...allScores),
    },
  };
}

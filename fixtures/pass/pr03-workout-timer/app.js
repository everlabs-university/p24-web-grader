'use strict';

function createWorkoutPlan(rounds, workSeconds, restSeconds) {
  const valid = Number.isInteger(rounds) && rounds >= 1 && rounds <= 20
    && Number.isInteger(workSeconds) && workSeconds >= 5 && workSeconds <= 3600
    && Number.isInteger(restSeconds) && restSeconds >= 0 && restSeconds <= 1800;

  if (!valid) return { ok: false, message: 'Invalid workout values.' };

  const steps = [];
  let totalDuration = 0;
  for (let round = 1; round <= rounds; round += 1) {
    steps.push({ type: 'work', round, duration: workSeconds });
    totalDuration += workSeconds;
    if (restSeconds > 0 && round < rounds) {
      steps.push({ type: 'rest', round, duration: restSeconds });
      totalDuration += restSeconds;
    }
  }
  return { ok: true, rounds, workSeconds, restSeconds, steps, totalDuration };
}

function formatDuration(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

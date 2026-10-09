import {
  createQuiz,
  nextQuestion,
  restartQuiz,
  selectAnswer,
  submitAnswer,
} from './quiz-engine.js';

const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

function renderError(root, message) {
  root.innerHTML = `<section class="quiz-error" role="alert"><h2>Quiz unavailable</h2><p>${escapeHtml(message)}</p></section>`;
}

function renderQuestion(root, state) {
  const question = state.questions[state.currentIndex];
  const latest = state.answers.at(-1);
  const review = state.status === 'review';
  const nextLabel = state.currentIndex === state.questions.length - 1 ? 'Show results' : 'Next question';

  root.innerHTML = `
    <section class="quiz-card" aria-labelledby="quiz-question">
      <p class="quiz-progress" data-quiz-progress>Question ${state.currentIndex + 1} / ${state.questions.length}</p>
      <h2 id="quiz-question">${escapeHtml(question.text)}</h2>
      <div class="answers" role="radiogroup" aria-labelledby="quiz-question">
        ${question.answers.map((answer) => `
          <button class="answer" type="button" role="radio" data-answer-id="${escapeHtml(answer.id)}"
            aria-checked="${String(state.selectedAnswerId === answer.id)}" ${review ? 'disabled' : ''}>
            ${escapeHtml(answer.text)}
          </button>
        `).join('')}
      </div>
      ${review ? `
        <p class="feedback ${latest.isCorrect ? 'correct' : 'incorrect'}" role="status">
          ${latest.isCorrect ? 'Correct!' : 'Not correct this time.'}
        </p>
        <button class="primary" type="button" data-action="next">${nextLabel}</button>
      ` : `
        <button class="primary" type="button" data-action="submit" ${state.selectedAnswerId ? '' : 'disabled'}>
          Submit answer
        </button>
      `}
    </section>`;
}

function renderCompleted(root, state) {
  root.innerHTML = `
    <section class="quiz-card results" aria-labelledby="quiz-result-title">
      <p class="eyebrow">Finished</p>
      <h2 id="quiz-result-title">Quiz complete</h2>
      <p class="score" data-quiz-score>${state.score} / ${state.questions.length}</p>
      <p>You answered ${state.score} of ${state.questions.length} questions correctly.</p>
      <button class="primary" type="button" data-action="restart">Restart quiz</button>
    </section>`;
}

export function mountQuiz(root, questions) {
  if (!root || typeof root.addEventListener !== 'function' || !('innerHTML' in root)) {
    return { ok: false, message: 'A valid quiz root element is required.' };
  }

  const created = createQuiz(questions);
  if (!created.ok) {
    renderError(root, created.message);
    return created;
  }

  let state = created.state;
  const render = () => {
    if (state.status === 'completed') renderCompleted(root, state);
    else renderQuestion(root, state);
  };
  const commit = (result) => {
    if (!result.ok) return false;
    state = result.state;
    render();
    return true;
  };

  root.addEventListener('click', (event) => {
    const button = event.target.closest?.('button');
    if (!button || !root.contains(button)) return;
    const answerId = button.dataset.answerId;
    if (answerId) commit(selectAnswer(state, answerId));
    if (button.dataset.action === 'submit') commit(submitAnswer(state));
    if (button.dataset.action === 'next') commit(nextQuestion(state));
    if (button.dataset.action === 'restart') commit(restartQuiz(state));
  });

  render();
  return { ok: true, getState: () => state };
}

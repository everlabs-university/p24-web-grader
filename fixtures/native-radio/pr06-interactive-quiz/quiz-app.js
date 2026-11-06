import { createQuiz, nextQuestion, restartQuiz, selectAnswer, submitAnswer } from './quiz-engine.js';

export function mountQuiz(root, questions) {
  const created = createQuiz(questions);
  if (!created.ok) {
    root.innerHTML = `<p role="alert">${created.message}</p>`;
    return created;
  }

  let state = created.state;
  function render() {
    if (state.status === 'completed') {
      root.innerHTML = `<h2>Quiz complete</h2><p class="quiz-score">${state.score} / ${state.questions.length}</p><button class="restart-btn">Restart</button>`;
      return;
    }
    const question = state.questions[state.currentIndex];
    const review = state.status === 'review';
    root.innerHTML = `
      <p class="quiz-progress">Question ${state.currentIndex + 1} / ${state.questions.length}</p>
      <h2>${question.text}</h2>
      <div role="radiogroup">
        ${question.answers.map((answer) => `<label class="${review && answer.id === question.correctAnswerId ? 'correct' : ''}"><input type="radio" name="quiz-option" value="${answer.id}" data-id="${answer.id}" ${state.selectedAnswerId === answer.id ? 'checked' : ''} ${review ? 'disabled' : ''}>${answer.text}</label>`).join('')}
      </div>
      ${review ? '<p class="feedback correct">Correct!</p><button class="next-btn">Next</button>' : `<button class="submit-btn" ${state.selectedAnswerId === null ? 'disabled' : ''}>Submit</button>`}`;
  }

  root.addEventListener('change', (event) => {
    if (!event.target.matches('input[type="radio"]')) return;
    const result = selectAnswer(state, event.target.value);
    if (result.ok) state = result.state;
    render();
  });
  root.addEventListener('click', (event) => {
    let result;
    if (event.target.matches('.submit-btn')) result = submitAnswer(state);
    if (event.target.matches('.next-btn')) result = nextQuestion(state);
    if (event.target.matches('.restart-btn')) result = restartQuiz(state);
    if (result?.ok) state = result.state;
    if (result) render();
  });
  render();
  return { ok: true };
}

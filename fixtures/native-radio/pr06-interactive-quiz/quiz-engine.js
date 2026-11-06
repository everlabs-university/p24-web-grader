function invalid(message) {
  return { ok: false, message };
}

function validQuestions(questions) {
  return Array.isArray(questions)
    && questions.length > 0
    && questions.every((question) => question?.text && Array.isArray(question.answers) && question.answers.length > 0);
}

export function createQuiz(questions) {
  if (!validQuestions(questions)) return invalid('Invalid questions.');
  return {
    ok: true,
    state: {
      questions: questions.map((question) => ({ ...question, answers: question.answers.map((answer) => ({ ...answer })) })),
      currentIndex: 0,
      selectedAnswerId: null,
      submittedAnswers: {},
      score: 0,
      status: 'answering',
    },
  };
}

export function selectAnswer(state, answerId) {
  if (state?.status !== 'answering') return invalid('Cannot select an answer.');
  return { ok: true, state: { ...state, selectedAnswerId: answerId } };
}

export function submitAnswer(state) {
  if (state?.status !== 'answering' || state.selectedAnswerId === null) return invalid('Cannot submit.');
  const question = state.questions[state.currentIndex];
  return {
    ok: true,
    state: {
      ...state,
      submittedAnswers: { ...state.submittedAnswers, [state.currentIndex]: state.selectedAnswerId },
      score: state.score + (state.selectedAnswerId === question.correctAnswerId ? 1 : 0),
      status: 'review',
    },
  };
}

export function nextQuestion(state) {
  if (state?.status !== 'review') return invalid('Cannot advance.');
  const completed = state.currentIndex === state.questions.length - 1;
  return {
    ok: true,
    state: {
      ...state,
      currentIndex: completed ? state.currentIndex : state.currentIndex + 1,
      selectedAnswerId: null,
      status: completed ? 'completed' : 'answering',
    },
  };
}

export function restartQuiz(state) {
  return createQuiz(state?.questions);
}

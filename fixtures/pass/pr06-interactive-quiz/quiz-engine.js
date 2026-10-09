const failure = (message) => ({ ok: false, message });

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isQuestion(question) {
  if (!question || typeof question !== 'object') return false;
  if (!isNonEmptyString(question.id) || !isNonEmptyString(question.text)) return false;
  if (!Array.isArray(question.answers) || question.answers.length < 2) return false;

  const ids = new Set();
  for (const answer of question.answers) {
    if (!answer || typeof answer !== 'object') return false;
    if (!isNonEmptyString(answer.id) || !isNonEmptyString(answer.text) || ids.has(answer.id)) return false;
    ids.add(answer.id);
  }
  return isNonEmptyString(question.correctAnswerId) && ids.has(question.correctAnswerId);
}

function cloneQuestions(questions) {
  return questions.map((question) => ({
    ...question,
    answers: question.answers.map((answer) => ({ ...answer })),
  }));
}

function validQuestions(questions) {
  if (!Array.isArray(questions) || questions.length === 0) return false;
  const ids = new Set();
  for (const question of questions) {
    if (!isQuestion(question) || ids.has(question.id)) return false;
    ids.add(question.id);
  }
  return true;
}

function currentQuestion(state) {
  return state?.questions?.[state.currentIndex];
}

export function createQuiz(questions) {
  if (!validQuestions(questions)) return failure('Quiz questions are invalid.');
  return {
    ok: true,
    state: {
      questions: cloneQuestions(questions),
      currentIndex: 0,
      selectedAnswerId: null,
      answers: [],
      score: 0,
      status: 'answering',
    },
  };
}

export function selectAnswer(state, answerId) {
  const question = currentQuestion(state);
  if (!question || state.status !== 'answering') return failure('An answer cannot be selected now.');
  if (!question.answers.some((answer) => answer.id === answerId)) return failure('Unknown answer.');
  return { ok: true, state: { ...state, selectedAnswerId: answerId } };
}

export function submitAnswer(state) {
  const question = currentQuestion(state);
  if (!question || state.status !== 'answering') return failure('This question is already locked.');
  if (!question.answers.some((answer) => answer.id === state.selectedAnswerId)) {
    return failure('Select an answer before submitting.');
  }

  const isCorrect = state.selectedAnswerId === question.correctAnswerId;
  return {
    ok: true,
    state: {
      ...state,
      status: 'review',
      score: state.score + (isCorrect ? 1 : 0),
      answers: [
        ...state.answers,
        { questionId: question.id, answerId: state.selectedAnswerId, isCorrect },
      ],
    },
  };
}

export function nextQuestion(state) {
  if (!currentQuestion(state) || state.status !== 'review') return failure('Submit the current answer first.');
  const isLast = state.currentIndex === state.questions.length - 1;
  return {
    ok: true,
    state: {
      ...state,
      currentIndex: isLast ? state.currentIndex : state.currentIndex + 1,
      selectedAnswerId: null,
      status: isLast ? 'completed' : 'answering',
    },
  };
}

export function restartQuiz(state) {
  if (!validQuestions(state?.questions)) return failure('Quiz state is invalid.');
  return createQuiz(state.questions);
}

// API client to communicate with the Express backend
const API_BASE_URL = 'http://localhost:3000';

export async function checkBackendStatus() {
  try {
    const res = await fetch(`${API_BASE_URL}/`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (error) {
    console.warn('Backend status check failed:', error.message);
    return null;
  }
}

export async function startExam(userId = 'student-101', name = 'Badmosh') {
  const res = await fetch(`${API_BASE_URL}/exam/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, name }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to start exam' }));
    throw new Error(err.message || 'Failed to start exam');
  }
  return await res.json();
}

export async function getAllQuestions() {
  const res = await fetch(`${API_BASE_URL}/exam/mcq`);
  if (!res.ok) throw new Error('Failed to fetch questions');
  return await res.json();
}

export async function getQuestion(id) {
  const res = await fetch(`${API_BASE_URL}/exam/mcq/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch question ${id}`);
  return await res.json();
}

export async function submitAnswer(sessionId, questionId, selectedAnswer) {
  const res = await fetch(`${API_BASE_URL}/exam/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, questionId, selectedAnswer }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to submit answer' }));
    throw new Error(err.message || 'Failed to submit answer');
  }
  return await res.json();
}

export async function getSessionProgress(sessionId) {
  const res = await fetch(`${API_BASE_URL}/exam/session/${sessionId}`);
  if (!res.ok) throw new Error('Failed to fetch session progress');
  return await res.json();
}

export async function submitExam(sessionId) {
  const res = await fetch(`${API_BASE_URL}/exam/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to submit exam' }));
    throw new Error(err.message || 'Failed to submit exam');
  }
  return await res.json();
}

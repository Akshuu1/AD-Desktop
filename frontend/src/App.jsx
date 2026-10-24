// App.jsx
import { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  checkBackendStatus,
  startExam,
  getAllQuestions,
  submitAnswer,
  submitExam,
} from './services/api';
import './App.css';

function App() {
  // Screen views: 'permissions' | 'exam' | 'result'
  const [appState, setAppState] = useState('permissions');

  // Candidate details
  const [candidateName] = useState('Badmosh');
  const [candidateId] = useState('student-101');

  // Original state variables
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);
  const [timer, setTimer] = useState('');

  // Backend state
  const [backendOnline, setBackendOnline] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [savedQuestions, setSavedQuestions] = useState(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [examResult, setExamResult] = useState(null);

  // Original ref variables
  const videoRef = useRef(null);
  const pipVideoRef = useRef(null);

  useEffect(() => {
    // Check backend connection
    checkBackendStatus()
      .then((data) => {
        if (data) setBackendOnline(true);
      })
      .catch(() => setBackendOnline(false));

    // Register Listener for handling Timer Tick from Main
    let removeTimerTickListener = () => { };
    let removeCameraSnapListener = () => { };

    if (window.athena?.registerListenerForTimerTickFromMain) {
      removeTimerTickListener = window.athena.registerListenerForTimerTickFromMain((sec) => {
        setTimer(Math.floor(sec).toString());
      });
    }

    // Register Listener for handling Camera Snap Request from Main
    if (window.athena?.registerListenerForCameraSnapFromMain) {
      removeCameraSnapListener = window.athena.registerListenerForCameraSnapFromMain(saveVideoScreenShots);
    }

    return () => {
      removeTimerTickListener();
      removeCameraSnapListener();
    };
  }, []);

  // Sync video to PiP preview during exam
  useEffect(() => {
    if (videoRef.current?.srcObject && pipVideoRef.current) {
      pipVideoRef.current.srcObject = videoRef.current.srcObject;
    }
  }, [appState]);

  // Fallback timer if running outside Electron
  useEffect(() => {
    if (appState === 'exam' && !window.athena?.registerListenerForTimerTickFromMain) {
      const interval = setInterval(() => {
        setTimer((prev) => {
          const num = Number(prev) || 0;
          return (num + 1).toString();
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [appState]);

  // Original function: saveVideoScreenShots
  async function saveVideoScreenShots() {
    if (!videoRef.current || !videoRef.current.srcObject) {
      return;
    }

    try {
      const track = videoRef.current.srcObject.getVideoTracks()[0];
      if (!track) return;

      // Use ImageCapture API
      if (window.ImageCapture) {
        const imageCapture = new ImageCapture(track);
        const blob = await imageCapture.takePhoto();
        const arrayBuffer = await blob.arrayBuffer();

        // Send raw binary buffer to main process
        if (window.athena?.storeCameraSnapImageOnDisk) {
          window.athena.storeCameraSnapImageOnDisk(arrayBuffer);
        }
      }
    } catch (error) {
      console.error("Failed to capture image via ImageCapture:", error);
    }
  }

  // Original function: getCameraAccess
  async function getCameraAccess() {
    try {
      const videoData = await navigator.mediaDevices.getUserMedia({
        video: true,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = videoData;
      }
      setCameraEnabled(true);
    } catch (error) {
      alert('Cannot access Camera');
    }
  }

  // Original function: enableFullScreen
  async function enableFullScreen() {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
      setFullScreen(true);
    } catch (error) {
      alert('Cannot access full screen');
    }
  }

  // Connected function to start exam with backend
  async function handleStartExam() {
    setIsSubmitting(true);
    try {
      // 1. Start session on backend
      const sessionData = await startExam(candidateId, candidateName);
      setSessionId(sessionData.sessionId);

      // 2. Load questions from backend
      const questionList = await getAllQuestions();
      setQuestions(questionList);

      // 3. Start timer on main process
      if (window.athena?.startTimerOnMain) {
        await window.athena.startTimerOnMain();
      }

      setAppState('exam');
      setCurrentIndex(0);
    } catch (err) {
      console.error('Failed to start exam:', err);
      alert(`Could not start exam: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  // Save answer to backend and advance
  async function handleSaveAndNext() {
    const currentQ = questions[currentIndex];
    if (!currentQ) return;

    const selectedOption = selectedAnswers[currentQ.id];

    if (selectedOption !== undefined && sessionId) {
      try {
        if (!savedQuestions.has(currentQ.id)) {
          await submitAnswer(sessionId, currentQ.id, selectedOption);
          setSavedQuestions((prev) => new Set([...prev, currentQ.id]));
        }
      } catch (err) {
        console.warn('Answer submit error:', err.message);
      }
    }

    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  }

  // Submit full exam to backend
  async function handleFinalSubmit() {
    if (!sessionId) return;
    setIsSubmitting(true);

    try {
      const currentQ = questions[currentIndex];
      if (currentQ && selectedAnswers[currentQ.id] !== undefined && !savedQuestions.has(currentQ.id)) {
        await submitAnswer(sessionId, currentQ.id, selectedAnswers[currentQ.id]).catch(() => { });
      }

      const res = await submitExam(sessionId);
      setExamResult(res.result);
      setAppState('result');

      try {
        confetti({
          particleCount: 120,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch (e) { }
    } catch (err) {
      alert(`Submission failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  // 1. PERMISSIONS & SETUP VIEW (Preserving all original buttons & layout)
  if (appState === 'permissions') {
    return (
      <div className="page-container">
        {/* Header */}
        <div className="header-section">
          <h1>Hi {candidateName}!</h1>
          <p>Kindly Allow the following Permissions to Start the test:</p>
          <div className={`backend-badge ${backendOnline ? 'online' : 'offline'}`}>
            <span className="pulse-dot"></span>
            {backendOnline ? 'Backend Online (Port 3000)' : 'Connecting to Backend (Port 3000)...'}
          </div>
        </div>

        {/* Main Card */}
        <div className="card-container">
          {/* Section 1: Camera / Heimdall */}
          <div className="permission-item">
            <div className="permission-content">
              <h3>Configure Camera</h3>
              <p>Kindly configure Camera to attempt quiz/contests.</p>
              <div className="action-row">
                {/* Original Button 1 */}
                <button
                  className="btn btn-black"
                  disabled={cameraEnabled}
                  onClick={getCameraAccess}
                >
                  {cameraEnabled ? 'Camera Connected' : 'Get Camera Access'}
                </button>

                {/* Hidden/Active Video Feed Preview */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className={`video-preview ${cameraEnabled ? '' : 'hidden'}`}
                />
              </div>
            </div>
          </div>

          <div className="divider"></div>

          {/* Section 2: Fullscreen */}
          <div className="permission-item">
            <div className="permission-content">
              <h3>Switch to full screen</h3>
              {/* Original Button 2 */}
              <button
                className="btn btn-primary"
                disabled={fullScreen}
                onClick={() => {
                  enableFullScreen();
                }}
              >
                {fullScreen ? 'Full Screen Enabled' : 'Give Full Screen Permissions'}
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Action Buttons */}
        <div className="bottom-actions">
          {/* Original Button 3: Go To Test */}
          <button
            className="btn btn-primary"
            disabled={!cameraEnabled || !fullScreen || isSubmitting}
            onClick={async () => {
              try {
                await handleStartExam();
              } catch (error) {
                console.error(error);
              }
            }}
          >
            {isSubmitting ? 'Starting Exam...' : 'Go To Test'}
          </button>
        </div>

        {/* Original Timer Display */}
        <div style={{ marginTop: '16px', fontWeight: 'bold', color: '#1e293b' }}>
          {timer ? `${timer} (s) elapsed` : '0 (s) elapsed'}
        </div>

        {/* Original Button 4: saveVideoScreenShots */}
        <div style={{ marginTop: '12px' }}>
          <button
            className="btn btn-outline"
            onClick={() => {
              saveVideoScreenShots();
            }}
          >
            saveVideoScreenShots
          </button>
        </div>

        {/* Original Buttons 5 & 6: Rules Buttons */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
          <button
            className="btn btn-outline"
            onClick={() => {
              if (window.athena?.showRules) {
                window.athena.showRules();
              } else {
                alert(
                  "Athena Exam Rules:\n1. Stay on the exam screen.\n2. Camera must remain enabled.\n3. Do not leave the exam.\n4. Do not use external assistance.\n5. Click Submit Exam when finished."
                );
              }
            }}
          >
            Show Native Rules
          </button>

          <button
            className="btn btn-outline"
            onClick={() => {
              alert(
                "Athena Exam Rules (Chromium):\n1. Camera and fullscreen are actively monitored.\n2. Answers are saved to backend on port 3000.\n3. Complete all MCQs before submitting."
              );
            }}
          >
            Show Chromium Rules
          </button>
        </div>
      </div>
    );
  }

  // 2. EXAM VIEW (Connected to Backend questions and submission)
  if (appState === 'exam') {
    const currentQ = questions[currentIndex];
    const selectedOpt = currentQ ? selectedAnswers[currentQ.id] : undefined;

    return (
      <div className="exam-layout">
        <header className="exam-navbar">
          <div className="brand-badge">
            <span className="brand-title">Athena Proctored Exam</span>
            <span className="proctor-chip">
              <span className="pulse-dot"></span> Heimdall Active
            </span>
          </div>

          <div className="exam-nav-center">
            <div className="timer-pill">
              ⏱ {timer ? `${timer} (s) elapsed` : '0 (s) elapsed'}
            </div>
          </div>

          <div className="exam-nav-right">
            {/* Live Camera Feed Preview */}
            <div className="pip-webcam-container">
              <video
                ref={pipVideoRef}
                autoPlay
                playsInline
                muted
                className="pip-webcam-video"
              />
              <div className="pip-badge">Proctored</div>
            </div>

            <button
              className="btn btn-danger"
              disabled={isSubmitting}
              onClick={handleFinalSubmit}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Exam'}
            </button>
          </div>
        </header>

        <main className="exam-main">
          {currentQ ? (
            <div className="question-panel">
              <div className="question-header">
                <span className="question-number-badge">
                  Question {currentIndex + 1} of {questions.length}
                </span>
                <span style={{ fontSize: '13px', color: '#64748b' }}>
                  Candidate: <strong>{candidateName}</strong> ({candidateId})
                </span>
              </div>

              <h2 className="question-text">{currentQ.question}</h2>

              <div className="options-list">
                {currentQ.options?.map((optionText, optIndex) => {
                  const isSelected = selectedOpt === optIndex;
                  const labelLetter = String.fromCharCode(65 + optIndex);

                  return (
                    <div
                      key={optIndex}
                      className={`option-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedAnswers((prev) => ({
                          ...prev,
                          [currentQ.id]: optIndex,
                        }));
                      }}
                    >
                      <div className="option-index">{labelLetter}</div>
                      <span className="option-label">{optionText}</span>
                    </div>
                  );
                })}
              </div>

              <div className="exam-controls">
                <button
                  className="btn btn-outline"
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex((prev) => prev - 1)}
                >
                  Previous
                </button>

                <div style={{ display: 'flex', gap: '10px' }}>
                  {selectedOpt !== undefined && (
                    <button
                      className="btn btn-outline"
                      onClick={() => {
                        setSelectedAnswers((prev) => {
                          const copy = { ...prev };
                          delete copy[currentQ.id];
                          return copy;
                        });
                      }}
                    >
                      Clear Selection
                    </button>
                  )}

                  {currentIndex < questions.length - 1 ? (
                    <button
                      className="btn btn-primary"
                      onClick={handleSaveAndNext}
                    >
                      Save & Next
                    </button>
                  ) : (
                    <button
                      className="btn btn-primary"
                      onClick={handleFinalSubmit}
                    >
                      Submit Exam
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="question-panel">
              <p>Loading questions from backend...</p>
            </div>
          )}

          {/* Question Palette */}
          <aside className="palette-sidebar">
            <h3 className="palette-title">Question Palette</h3>
            <div className="palette-grid">
              {questions.map((q, idx) => {
                const answered = selectedAnswers[q.id] !== undefined;
                const isCurrent = idx === currentIndex;

                return (
                  <button
                    key={q.id}
                    className={`palette-btn ${isCurrent ? 'active' : ''} ${answered ? 'answered' : ''}`}
                    onClick={() => setCurrentIndex(idx)}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            <div className="palette-legend">
              <div className="legend-item">
                <div className="legend-dot answered"></div>
                <span>Answered ({Object.keys(selectedAnswers).length})</span>
              </div>
              <div className="legend-item">
                <div className="legend-dot current"></div>
                <span>Current Question</span>
              </div>
              <div className="legend-item">
                <div className="legend-dot unvisited"></div>
                <span>Not Answered ({questions.length - Object.keys(selectedAnswers).length})</span>
              </div>
            </div>
          </aside>
        </main>
      </div>
    );
  }

  // 3. RESULT VIEW
  if (appState === 'result' && examResult) {
    const accuracy = examResult.attempted > 0
      ? Math.round((examResult.correct / examResult.attempted) * 100)
      : 0;

    return (
      <div className="page-container">
        <div className="result-card">
          <h2>Exam Submitted Successfully!</h2>
          <p className="result-sub">
            Candidate: <strong>{candidateName}</strong> ({candidateId})
          </p>

          <div className="metrics-grid">
            <div className="metric-box">
              <div className="metric-label">Attempted</div>
              <div className="metric-value">{examResult.attempted} / {questions.length}</div>
            </div>
            <div className="metric-box">
              <div className="metric-label">Correct</div>
              <div className="metric-value correct">{examResult.correct}</div>
            </div>
            <div className="metric-box">
              <div className="metric-label">Wrong</div>
              <div className="metric-value wrong">{examResult.wrong}</div>
            </div>
          </div>

          <div style={{ marginBottom: '24px', fontSize: '15px', color: '#475569' }}>
            Final Accuracy: <strong>{accuracy}%</strong> • Time: <strong>{timer || '0'} (s) elapsed</strong>
          </div>

          <button
            className="btn btn-primary"
            onClick={() => {
              setAppState('permissions');
              setSelectedAnswers({});
              setSavedQuestions(new Set());
              setSessionId(null);
              setExamResult(null);
              setTimer('');
              setCurrentIndex(0);
            }}
          >
            Take Another Test
          </button>
        </div>
      </div>
    );
  }

  return null;
}

export default App;
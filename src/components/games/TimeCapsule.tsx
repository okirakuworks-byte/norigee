import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GameIntro from './GameIntro';
import GameResult from './GameResult';
import GameComments from './GameComments';

// --- Question data ---

interface Question {
  sentence: string;
  choices: string[]; // index 0 is always the correct answer (shuffled at runtime)
}

// Level 1: single short sentence, 2 sec display
const LEVEL1_QUESTIONS: Question[] = [
  {
    sentence: '猫が窓の外を見ている',
    choices: ['猫が窓の外を見ている', '猫が窓の中を見ている', '猫が外の窓を見ている', '猫が窓の隅を見ている'],
  },
  {
    sentence: '財布を机の上に置いた',
    choices: ['財布を机の上に置いた', '財布を机の下に置いた', '財布を椅子の上に置いた', '財布を机の上に忘れた'],
  },
  {
    sentence: '朝7時に目が覚めた',
    choices: ['朝7時に目が覚めた', '朝7時に目が覚めない', '夜7時に目が覚めた', '朝8時に目が覚めた'],
  },
  {
    sentence: '雨が降り始めたので傘を開いた',
    choices: ['雨が降り始めたので傘を開いた', '雨が上がったので傘を開いた', '雨が降り始めたので傘を閉じた', '雨が降り始めたので窓を開いた'],
  },
  {
    sentence: 'コーヒーカップを左手で持った',
    choices: ['コーヒーカップを左手で持った', 'コーヒーカップを右手で持った', 'コーヒーカップを両手で持った', 'コーヒーを左手で飲んだ'],
  },
];

// Level 2: longer, display 1.5 sec, choices more similar
const LEVEL2_QUESTIONS: Question[] = [
  {
    sentence: '赤いバッグを持った女性が角を右に曲がった',
    choices: [
      '赤いバッグを持った女性が角を右に曲がった',
      '赤いバッグを持った女性が角を左に曲がった',
      '青いバッグを持った女性が角を右に曲がった',
      '赤いバッグを持った男性が角を右に曲がった',
    ],
  },
  {
    sentence: '午後3時に電話が3回鳴って切れた',
    choices: [
      '午後3時に電話が3回鳴って切れた',
      '午後3時に電話が2回鳴って切れた',
      '午前3時に電話が3回鳴って切れた',
      '午後3時に電話が3回鳴って繋がった',
    ],
  },
  {
    sentence: '白い封筒の中に名刺が2枚入っていた',
    choices: [
      '白い封筒の中に名刺が2枚入っていた',
      '白い封筒の中に名刺が3枚入っていた',
      '白い封筒の中に手紙が2枚入っていた',
      '茶色い封筒の中に名刺が2枚入っていた',
    ],
  },
];

// Level 3: two sentences simultaneously, display 1 sec, very similar choices
const LEVEL3_PAIRS: { sentences: [string, string]; choices: string[][] } [] = [
  {
    sentences: ['駅のホームで本を読んでいた', 'バッグは足元に置いてあった'],
    choices: [
      ['駅のホームで本を読んでいた', '駅の改札で本を読んでいた', '駅のホームで新聞を読んでいた', 'バスの中で本を読んでいた'],
      ['バッグは足元に置いてあった', 'バッグは棚の上に置いてあった', 'カバンは足元に置いてあった', 'バッグは足元に落ちていた'],
    ],
  },
  {
    sentences: ['信号が青になった瞬間に渡り始めた', '右側から自転車が来ていた'],
    choices: [
      ['信号が青になった瞬間に渡り始めた', '信号が赤になった瞬間に渡り始めた', '信号が青になったあとで渡り始めた', '信号が青になった瞬間に引き返した'],
      ['右側から自転車が来ていた', '左側から自転車が来ていた', '右側からバイクが来ていた', '右側から自転車が去っていた'],
    ],
  },
];

type Level = 1 | 2 | 3;
type Phase = 'ready' | 'show' | 'answer' | 'feedback' | 'gameover' | 'clear';

interface GameState {
  level: Level;
  questionIdx: number;
  correct: number;
  total: number;
}

function shuffleChoices(choices: string[]): string[] {
  return [...choices].sort(() => Math.random() - 0.5);
}

const DISPLAY_TIMES: Record<Level, number> = { 1: 2000, 2: 1500, 3: 1000 };
const QUESTIONS_TO_CLEAR = 8;
const LEVEL_THRESHOLDS: Record<Level, number> = { 1: 0, 2: 3, 3: 6 };

export default function TimeCapsule() {
  const [phase, setPhase] = useState<Phase>('ready');
  const [gameState, setGameState] = useState<GameState>({ level: 1, questionIdx: 0, correct: 0, total: 0 });
  const [shuffledChoices, setShuffledChoices] = useState<string[]>([]);
  const [shuffledChoices2, setShuffledChoices2] = useState<string[]>([]); // for Lv3 second sentence
  const [activeQuestion, setActiveQuestion] = useState<Question | null>(null);
  const [activePair, setActivePair] = useState<typeof LEVEL3_PAIRS[0] | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [selectedIdx2, setSelectedIdx2] = useState<number | null>(null);
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  useEffect(() => () => clearTimer(), []);

  const getLevel = useCallback((correct: number): Level => {
    if (correct >= LEVEL_THRESHOLDS[3]) return 3;
    if (correct >= LEVEL_THRESHOLDS[2]) return 2;
    return 1;
  }, []);

  const loadQuestion = useCallback((state: GameState) => {
    const level = getLevel(state.correct);
    if (level === 3) {
      const idx = Math.floor(Math.random() * LEVEL3_PAIRS.length);
      const pair = LEVEL3_PAIRS[idx];
      setActivePair(pair);
      setActiveQuestion(null);
      setShuffledChoices(shuffleChoices(pair.choices[0]));
      setShuffledChoices2(shuffleChoices(pair.choices[1]));
    } else {
      const pool = level === 2 ? LEVEL2_QUESTIONS : LEVEL1_QUESTIONS;
      const idx = Math.floor(Math.random() * pool.length);
      const q = pool[idx];
      setActiveQuestion(q);
      setActivePair(null);
      setShuffledChoices(shuffleChoices(q.choices));
      setShuffledChoices2([]);
    }
    setSelectedIdx(null);
    setSelectedIdx2(null);
    setLastCorrect(null);
    setGameState({ ...state, level });
    setPhase('show');

    // Auto-hide after display time
    clearTimer();
    timerRef.current = setTimeout(() => {
      setPhase('answer');
    }, DISPLAY_TIMES[level]);
  }, [getLevel]);

  const startGame = useCallback(() => {
    const initial: GameState = { level: 1, questionIdx: 0, correct: 0, total: 0 };
    loadQuestion(initial);
  }, [loadQuestion]);

  const handleAnswer = useCallback((choiceIdx: number, which: 1 | 2 = 1) => {
    if (phase !== 'answer') return;
    if (which === 1) setSelectedIdx(choiceIdx);
    else setSelectedIdx2(choiceIdx);
  }, [phase]);

  // Evaluate when selection is made
  useEffect(() => {
    if (phase !== 'answer') return;

    const level = gameState.level;

    if (level === 3) {
      // Both must be selected
      if (selectedIdx === null || selectedIdx2 === null) return;
      const correct1 = shuffledChoices[selectedIdx] === LEVEL3_PAIRS[0]?.sentences[0] ||
        (activePair !== null && shuffledChoices[selectedIdx] === activePair.sentences[0]);
      const correct2 = shuffledChoices2[selectedIdx2] === LEVEL3_PAIRS[0]?.sentences[1] ||
        (activePair !== null && shuffledChoices2[selectedIdx2] === activePair.sentences[1]);
      const allCorrect = correct1 && correct2;
      evaluate(allCorrect);
    } else {
      if (selectedIdx === null) return;
      const correct = activeQuestion !== null && shuffledChoices[selectedIdx] === activeQuestion.choices[0];
      evaluate(correct);
    }
  }, [selectedIdx, selectedIdx2]); // eslint-disable-line react-hooks/exhaustive-deps

  const evaluate = (correct: boolean) => {
    setLastCorrect(correct);
    setPhase('feedback');

    const newCorrect = correct ? gameState.correct + 1 : gameState.correct;
    const newTotal = gameState.total + 1;

    setTimeout(() => {
      if (!correct) {
        setGameState((p) => ({ ...p, correct: newCorrect, total: newTotal }));
        setPhase('gameover');
        return;
      }
      if (newCorrect >= QUESTIONS_TO_CLEAR) {
        setGameState((p) => ({ ...p, correct: newCorrect, total: newTotal }));
        setPhase('clear');
        return;
      }
      const next: GameState = { ...gameState, correct: newCorrect, total: newTotal, questionIdx: gameState.questionIdx + 1 };
      loadQuestion(next);
    }, 800);
  };

  const levelLabel: Record<Level, string> = { 1: 'LV.1', 2: 'LV.2', 3: 'LV.3' };

  return (
    <div className="relative max-w-lg mx-auto px-4 py-8">
      {/* Danmaku comments during play */}
      {(phase === 'show' || phase === 'answer' || phase === 'feedback') && (
        <GameComments gameId="time-capsule" mode="danmaku" />
      )}

      <AnimatePresence mode="wait">
        {phase === 'ready' && (
          <motion.div key="ready" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <GameIntro
              icon="🧠"
              title="記憶バグ"
              gameId="time-capsule"
              subtitle="文章を見ろ。消える。その後、正確に思い出せ。"
              controls={[{ icon: '👁', label: 'READ', desc: '素早く文章を読む' }, { icon: '👆', label: 'TAP', desc: '正解を選択' }]}
              rules={[
                { text: '文章が短時間表示されて消える' },
                { text: 'Lv1: 2秒 / Lv2: 1.5秒 / Lv3: 1秒 + 2文同時', highlight: true },
                { text: '選択肢は1文字違い・語順違いの罠あり' },
                { text: '1ミスで即ゲームオーバー。8問正解でクリア' },
              ]}
              tip="消えた後にじっくり考えても遅い。瞬間記憶を鍛えろ。"
              buttonText="START"
              buttonColor="bg-neon-pink text-white"
              onStart={startGame}
            />
          </motion.div>
        )}

        {phase === 'show' && (
          <motion.div
            key={`show-${gameState.questionIdx}`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <span className="font-['Orbitron'] text-xs text-neon-pink">{levelLabel[gameState.level]}</span>
              <span className="font-['Orbitron'] text-xs text-text-muted">
                {gameState.correct} / {QUESTIONS_TO_CLEAR}
              </span>
            </div>

            <div className="text-center py-2">
              <p className="font-['Orbitron'] text-[10px] text-text-muted tracking-widest mb-4">
                MEMORIZE
              </p>
              {gameState.level === 3 && activePair ? (
                <div className="space-y-3">
                  {activePair.sentences.map((s, i) => (
                    <div key={i} className="bg-bg-surface border border-neon-pink rounded-xl p-4">
                      <p className="font-['Share_Tech_Mono'] text-text-primary text-sm">{i + 1}. {s}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-bg-surface border border-neon-pink rounded-xl p-6">
                  <p className="font-['Share_Tech_Mono'] text-text-primary text-base">{activeQuestion?.sentence}</p>
                </div>
              )}
            </div>

            {/* Countdown bar */}
            <motion.div
              className="w-full h-1.5 bg-neon-pink rounded-full origin-left"
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              transition={{ duration: DISPLAY_TIMES[gameState.level] / 1000, ease: 'linear' }}
            />
          </motion.div>
        )}

        {(phase === 'answer' || phase === 'feedback') && (
          <motion.div
            key={`answer-${gameState.questionIdx}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <span className="font-['Orbitron'] text-xs text-neon-pink">{levelLabel[gameState.level]}</span>
              <span className="font-['Orbitron'] text-xs text-text-muted">
                {gameState.correct} / {QUESTIONS_TO_CLEAR}
              </span>
            </div>

            <p className="font-['Orbitron'] text-[10px] text-text-muted tracking-widest text-center">
              {gameState.level === 3 ? 'どちらの文章が正しい？（両方選べ）' : 'さっきの文章はどれ？'}
            </p>

            {/* Choices for sentence 1 (or only sentence for Lv1/2) */}
            <div className="space-y-2">
              {shuffledChoices.map((choice, i) => {
                const isSelected = selectedIdx === i;
                const isCorrectChoice = gameState.level === 3
                  ? activePair !== null && choice === activePair.sentences[0]
                  : activeQuestion !== null && choice === activeQuestion.choices[0];
                const showResult = phase === 'feedback';
                return (
                  <motion.button
                    key={i}
                    onClick={() => handleAnswer(i, 1)}
                    disabled={phase === 'feedback' || selectedIdx !== null}
                    whileTap={{ scale: 0.98 }}
                    className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all ${
                      showResult
                        ? isCorrectChoice
                          ? 'border-neon-cyan bg-neon-cyan/10 text-neon-cyan'
                          : isSelected
                            ? 'border-neon-pink bg-neon-pink/10 text-neon-pink'
                            : 'border-bg-raised bg-bg-surface text-text-muted'
                        : isSelected
                          ? 'border-neon-yellow bg-neon-yellow/10 text-neon-yellow'
                          : 'border-bg-raised bg-bg-surface text-text-primary hover:border-neon-yellow/40'
                    }`}
                  >
                    {choice}
                  </motion.button>
                );
              })}
            </div>

            {/* Choices for sentence 2 (Lv3 only) */}
            {gameState.level === 3 && shuffledChoices2.length > 0 && (
              <>
                <p className="font-['Orbitron'] text-[10px] text-text-muted tracking-widest text-center mt-2">
                  2文目:
                </p>
                <div className="space-y-2">
                  {shuffledChoices2.map((choice, i) => {
                    const isSelected = selectedIdx2 === i;
                    const isCorrectChoice = activePair !== null && choice === activePair.sentences[1];
                    const showResult = phase === 'feedback';
                    return (
                      <motion.button
                        key={i}
                        onClick={() => handleAnswer(i, 2)}
                        disabled={phase === 'feedback' || selectedIdx2 !== null}
                        whileTap={{ scale: 0.98 }}
                        className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all ${
                          showResult
                            ? isCorrectChoice
                              ? 'border-neon-cyan bg-neon-cyan/10 text-neon-cyan'
                              : isSelected
                                ? 'border-neon-pink bg-neon-pink/10 text-neon-pink'
                                : 'border-bg-raised bg-bg-surface text-text-muted'
                            : isSelected
                              ? 'border-neon-yellow bg-neon-yellow/10 text-neon-yellow'
                              : 'border-bg-raised bg-bg-surface text-text-primary hover:border-neon-yellow/40'
                        }`}
                      >
                        {choice}
                      </motion.button>
                    );
                  })}
                </div>
              </>
            )}

            <AnimatePresence>
              {phase === 'feedback' && lastCorrect !== null && (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`text-center font-['Orbitron'] text-sm font-bold ${lastCorrect ? 'text-neon-cyan' : 'text-neon-pink'}`}
                >
                  {lastCorrect ? 'CORRECT' : 'WRONG'}
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {phase === 'gameover' && (
          <motion.div key="gameover" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <GameResult
              gameId="time-capsule"
              gameName="TIME CAPSULE"
              icon="🧠"
              score={gameState.correct * 100}
              level={gameState.level}
              deathReason="MEMORY LEAK — 記憶力: 金魚（7秒）"
              extraInfo={`正解数: ${gameState.correct} / ${gameState.total}`}
              onRetry={() => setPhase('ready')}
            />
          </motion.div>
        )}

        {phase === 'clear' && (
          <motion.div key="clear" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <GameResult
              gameId="time-capsule"
              gameName="TIME CAPSULE"
              icon="🧠"
              score={gameState.correct * 100}
              level={gameState.level}
              extraInfo="記憶力: 金魚以上。人間認定。"
              onRetry={() => setPhase('ready')}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

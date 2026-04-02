import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GameIntro from './GameIntro';
import GameResult from './GameResult';
import GameComments from './GameComments';

interface Scenario {
  messages: string[];
  choices: { text: string; leakage: number }[]; // leakage 0=safe, 1-3=danger
  correctIdx: number;
}

const SCENARIOS: Scenario[] = [
  {
    messages: ['もしもし、IT部の田中です。', 'セキュリティアップデートのため、社員番号を教えてください。'],
    choices: [
      { text: '社員番号はE-12345です', leakage: 3 },
      { text: 'IT部に直接確認します', leakage: 0 },
      { text: '上司に確認してから折り返します', leakage: 0 },
    ],
    correctIdx: 1,
  },
  {
    messages: ['お世話になっております、○○銀行です。', '口座の不正利用が検知されました。至急、暗証番号の確認をお願いします。'],
    choices: [
      { text: '暗証番号は1234です', leakage: 3 },
      { text: '銀行に直接電話して確認します', leakage: 0 },
      { text: '不正利用の詳細を教えてください', leakage: 1 },
    ],
    correctIdx: 1,
  },
  {
    messages: ['佐藤部長から指示がありまして。', '急ぎで取引先のA社に振込が必要とのことです。口座情報を送っていただけますか？'],
    choices: [
      { text: 'A社の口座情報を送ります', leakage: 3 },
      { text: '佐藤部長に直接確認します', leakage: 0 },
      { text: 'メールで送ってもらえますか？', leakage: 1 },
    ],
    correctIdx: 1,
  },
  {
    messages: ['Wi-Fiの調査で来ました。', 'ネットワークパスワードを確認させてください。社内のセキュリティ監査です。'],
    choices: [
      { text: 'パスワードは company2024 です', leakage: 3 },
      { text: '社員証を見せてください', leakage: 0 },
      { text: '管理部に確認してからお願いします', leakage: 0 },
    ],
    correctIdx: 1,
  },
  {
    messages: ['先日のセミナーでお名刺交換した者です。', '御社のシステム構成について、少しお話を伺えますか？'],
    choices: [
      { text: 'AWSとSupabaseを使っています', leakage: 2 },
      { text: 'お名前をもう一度いただけますか？', leakage: 0 },
      { text: '技術的な話は担当部署に繋ぎます', leakage: 0 },
    ],
    correctIdx: 2,
  },
  {
    messages: ['緊急です！サーバーがダウンしています！', 'リモートアクセスの認証情報を今すぐ教えてください！'],
    choices: [
      { text: 'ユーザー名admin、パスはXXXです', leakage: 3 },
      { text: '落ち着いてください。チケット番号は？', leakage: 0 },
      { text: 'VPN情報は共有できません', leakage: 0 },
    ],
    correctIdx: 1,
  },
  {
    messages: ['こんにちは！新しいSaaSツールの無料トライアルのご案内です。', '今なら社用メールで登録するだけで全機能使えます。メールアドレスを教えてください。'],
    choices: [
      { text: 'employee@company.co.jp です', leakage: 2 },
      { text: '公式サイトから自分で登録します', leakage: 0 },
      { text: '情シスに確認してからにします', leakage: 0 },
    ],
    correctIdx: 1,
  },
  {
    messages: ['宅配便です。お届け物がありますが、', 'ご不在でしたので、お届け先の住所を再確認させてください。'],
    choices: [
      { text: '東京都渋谷区...', leakage: 2 },
      { text: '伝票番号を教えてください', leakage: 0 },
      { text: '再配達はWebから手配します', leakage: 0 },
    ],
    correctIdx: 2,
  },
  // Hard: All choices leak something
  {
    messages: ['社長の山田です。出張中で急いでいます。', '経理の鈴木さんの直通番号を教えてくれませんか？'],
    choices: [
      { text: '鈴木さんは03-XXXX-XXXXです', leakage: 2 },
      { text: '社長、折り返しお電話いただけますか', leakage: 1 },
      { text: '内線番号だけお伝えします: 2345', leakage: 1 },
    ],
    correctIdx: 1, // least leakage
  },
  {
    messages: ['清掃業者の者です。オフィスの鍵を忘れてしまいまして。', 'セキュリティコードを教えていただけますか？'],
    choices: [
      { text: 'コードは4567です', leakage: 3 },
      { text: '管理室に行ってください', leakage: 0 },
      { text: '社員証を見せてから案内します', leakage: 0 },
    ],
    correctIdx: 1,
  },
];

type Phase = 'ready' | 'ringing' | 'chatting' | 'choosing' | 'result' | 'compromised';

export default function SocialEngineerGame() {
  const [phase, setPhase] = useState<Phase>('ready');
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [leakage, setLeakage] = useState(0); // HP: 0-100, 100 = compromised
  const [shield, setShield] = useState(0);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [msgIdx, setMsgIdx] = useState(0);
  const [choiceTimer, setChoiceTimer] = useState(5);
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [usedScenarios, setUsedScenarios] = useState<number[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const getTimeLimit = useCallback(() => {
    if (round >= 7) return 3;
    if (round >= 4) return 4;
    return 5;
  }, [round]);

  const startRound = useCallback(() => {
    // Pick unused scenario
    const available = SCENARIOS.map((_, i) => i).filter((i) => !usedScenarios.includes(i));
    if (available.length === 0) {
      setUsedScenarios([]);
    }
    const pool = available.length > 0 ? available : SCENARIOS.map((_, i) => i);
    const idx = pool[Math.floor(Math.random() * pool.length)];
    setUsedScenarios((prev) => [...prev, idx]);
    setScenario(SCENARIOS[idx]);
    setMsgIdx(0);
    setSelectedChoice(null);
    setPhase('ringing');
  }, [usedScenarios]);

  const startGame = () => {
    setRound(0);
    setScore(0);
    setStreak(0);
    setLeakage(0);
    setShield(0);
    setUsedScenarios([]);
    startRound();
  };

  // Ringing → chatting
  useEffect(() => {
    if (phase !== 'ringing') return;
    const id = setTimeout(() => setPhase('chatting'), 1500);
    return () => clearTimeout(id);
  }, [phase]);

  // Chat messages one by one
  useEffect(() => {
    if (phase !== 'chatting' || !scenario) return;
    if (msgIdx >= scenario.messages.length) {
      setPhase('choosing');
      return;
    }
    const id = setTimeout(() => setMsgIdx((i) => i + 1), 1200);
    return () => clearTimeout(id);
  }, [phase, msgIdx, scenario]);

  // Choice timer
  useEffect(() => {
    if (phase !== 'choosing') return;
    const limit = getTimeLimit();
    setChoiceTimer(limit);
    const start = Date.now();

    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - start) / 1000;
      const remaining = Math.max(0, limit - elapsed);
      setChoiceTimer(remaining);
      if (remaining <= 0) {
        clearInterval(timerRef.current);
        // Time out = worst choice
        handleChoice(scenario!.choices.length - 1);
      }
    }, 50);

    return () => clearInterval(timerRef.current);
  }, [phase, getTimeLimit, scenario]);

  const handleChoice = (idx: number) => {
    if (phase !== 'choosing' || !scenario) return;
    clearInterval(timerRef.current);
    setSelectedChoice(idx);

    const choice = scenario.choices[idx];
    const isCorrect = idx === scenario.correctIdx;

    if (isCorrect) {
      setScore((s) => s + 200 + Math.floor(choiceTimer * 50));
      setStreak((s) => {
        const newStreak = s + 1;
        if (newStreak >= 3 && shield === 0) setShield(1);
        return newStreak;
      });
    } else {
      if (shield > 0 && choice.leakage > 0) {
        setShield(0);
      } else {
        setLeakage((l) => {
          const newL = Math.min(100, l + choice.leakage * 15);
          if (newL >= 100) {
            setTimeout(() => setPhase('compromised'), 1500);
          }
          return newL;
        });
      }
      setStreak(0);
    }

    setPhase('result');
  };

  const nextRound = () => {
    if (leakage >= 100) {
      setPhase('compromised');
      return;
    }
    setRound((r) => r + 1);
    startRound();
  };

  return (
    <div className="relative max-w-lg mx-auto px-4 py-6">
      {/* Danmaku comments during play */}
      {(phase === 'ringing' || phase === 'chatting' || phase === 'choosing' || phase === 'result') && (
        <GameComments gameId="social-engineer" mode="danmaku" />
      )}

      <div className="text-center mb-4">
        <p className="font-['Orbitron'] text-[10px] text-neon-yellow tracking-[0.3em] mb-1">SOCIAL ENGINEER</p>
        <h2 className="font-['Orbitron'] text-lg font-black text-text-primary">ソーシャルエンジニア</h2>
      </div>

      <AnimatePresence mode="wait">
        {phase === 'ready' && (
          <motion.div key="ready" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <GameIntro
              icon="📞"
              title="SOCIAL ENGINEER"
              gameId="social-engineer"
              subtitle="ソーシャルエンジニア"
              controls={[
                { icon: '👆', label: 'TAP', desc: '返答を選択' },
              ]}
              rules={[
                { text: '怪しい電話がかかってくる' },
                { text: `${getTimeLimit()}秒で正しい対応を選べ` },
                { text: '情報漏洩ゲージ100%でCOMPROMISED', highlight: true },
                { text: '3連続正解でシールド獲得' },
              ]}
              tip="緊急を装う電話ほど怪しい。焦らず確認"
              buttonText="ANSWER"
              buttonColor="bg-neon-yellow text-bg-deep"
              onStart={startGame}
            />
          </motion.div>
        )}

        {phase === 'ringing' && (
          <motion.div key="ringing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
            <motion.p className="text-6xl" animate={{ rotate: [0, -15, 15, -15, 15, 0] }} transition={{ duration: 0.5, repeat: Infinity }}>
              📞
            </motion.p>
            <p className="font-['Orbitron'] text-neon-yellow mt-4 animate-pulse">INCOMING CALL...</p>
          </motion.div>
        )}

        {(phase === 'chatting' || phase === 'choosing' || phase === 'result') && scenario && (
          <motion.div key="game" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* HUD */}
            <div className="flex items-center justify-between text-xs mb-3">
              <span className="font-['Share_Tech_Mono'] text-neon-yellow">SCORE: {score}</span>
              {shield > 0 && <span className="text-neon-cyan">🛡️</span>}
              {streak >= 2 && <span className="text-neon-yellow">🔥{streak}</span>}
              <span className="font-['Orbitron'] text-text-muted">CALL {round + 1}</span>
            </div>

            {/* Leakage bar */}
            <div className="mb-4">
              <div className="flex justify-between text-[10px] mb-1">
                <span className="text-text-muted">INFORMATION LEAKAGE</span>
                <span className={leakage >= 70 ? 'text-neon-pink' : 'text-text-muted'}>{leakage}%</span>
              </div>
              <div className="h-2 bg-bg-raised rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${leakage >= 70 ? 'bg-neon-pink' : leakage >= 40 ? 'bg-neon-yellow' : 'bg-neon-cyan'}`}
                  style={{ width: `${leakage}%` }}
                />
              </div>
            </div>

            {/* Chat */}
            <div className="bg-bg-surface border border-bg-raised rounded-xl p-4 mb-4 min-h-[150px]">
              <div className="space-y-3">
                {scenario.messages.slice(0, msgIdx).map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="flex gap-2"
                  >
                    <span className="text-lg flex-shrink-0">🕵️</span>
                    <div className="bg-bg-raised rounded-lg px-3 py-2 text-text-primary text-sm">
                      {msg}
                    </div>
                  </motion.div>
                ))}

                {selectedChoice !== null && (
                  <motion.div
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="flex gap-2 justify-end"
                  >
                    <div className={`rounded-lg px-3 py-2 text-sm ${
                      selectedChoice === scenario.correctIdx
                        ? 'bg-neon-cyan/20 text-neon-cyan'
                        : 'bg-neon-pink/20 text-neon-pink'
                    }`}>
                      {scenario.choices[selectedChoice].text}
                    </div>
                    <span className="text-lg flex-shrink-0">👤</span>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Choices */}
            {phase === 'choosing' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-text-muted">RESPOND:</span>
                  <span className={`font-['Share_Tech_Mono'] ${choiceTimer <= 2 ? 'text-neon-pink animate-pulse' : 'text-neon-yellow'}`}>
                    {Math.ceil(choiceTimer)}s
                  </span>
                </div>
                {/* Timer bar */}
                <div className="h-1 bg-bg-raised rounded-full overflow-hidden mb-3">
                  <div
                    className="h-full bg-neon-yellow transition-all duration-100"
                    style={{ width: `${(choiceTimer / getTimeLimit()) * 100}%` }}
                  />
                </div>
                {scenario.choices.map((choice, i) => (
                  <motion.button
                    key={i}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: i * 0.1 }}
                    onClick={() => handleChoice(i)}
                    className="w-full text-left px-4 py-3 bg-bg-deep border border-bg-raised rounded-lg text-text-primary text-sm hover:border-neon-yellow transition-colors"
                  >
                    {choice.text}
                  </motion.button>
                ))}
              </div>
            )}

            {/* Result */}
            {phase === 'result' && selectedChoice !== null && (
              <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-center space-y-3">
                {selectedChoice === scenario.correctIdx ? (
                  <p className="font-['Orbitron'] text-neon-cyan text-sm">✓ SAFE RESPONSE</p>
                ) : (
                  <p className="font-['Orbitron'] text-neon-pink text-sm">
                    {shield > 0 ? '🛡️ SHIELD ABSORBED' : `⚠ LEAKED (+${scenario.choices[selectedChoice].leakage * 15}%)`}
                  </p>
                )}
                <button onClick={nextRound} className="px-8 py-3 bg-neon-yellow text-bg-deep font-['Orbitron'] text-sm font-bold rounded-lg">
                  NEXT CALL
                </button>
              </motion.div>
            )}
          </motion.div>
        )}

        {phase === 'compromised' && (
          <motion.div key="compromised" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <GameResult
              gameId="social-engineer"
              gameName="SOCIAL ENGINEER"
              icon="📞"
              score={score}
              level={round + 1}
              deathReason="COMPROMISED — INFORMATION LEAKAGE: 100%"
              extraInfo={`${round + 1}件の電話に対応`}
              onRetry={() => setPhase('ready')}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

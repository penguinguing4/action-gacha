import React, { useState, useEffect } from 'react';

const BOOKS = [
  "7つの習慣", "夢をかなえるゾウ", "イシューからはじめよ",
  "FACTFULNESS", "GIVE & TAKE", "アウトプット大全"
];

export default function App() {
  const [dailyCount, setDailyCount] = useState(3);
  const [challenge, setChallenge] = useState("");
  const [timer, setTimer] = useState(0);
  const [intervalId, setIntervalId] = useState<number | null>(null);

  useEffect(() => {
    const reset = () => setDailyCount(3);
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    const timeout = midnight.getTime() - Date.now();
    const id = setTimeout(reset, timeout);
    return () => clearTimeout(id);
  }, []);

  const startChallenge = (book: string) => {
    setChallenge(`${book} から学んだ行動を1分間やってみよう！`);
    setTimer(60);
    if (intervalId) clearInterval(intervalId);
    const id = window.setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          clearInterval(id);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    setIntervalId(id);
  };

  const drawBook = () => {
    if (dailyCount > 0) {
      setDailyCount(c => c - 1);
      const book = BOOKS[Math.floor(Math.random() * BOOKS.length)];
      startChallenge(book);
    } else {
      alert("今日はもう無料ガチャはありません（広告 or VIPで回復）");
    }
  };

  return (
    <div className="p-4 text-center">
      <h1 className="text-2xl font-bold mb-4">📚 行動ガチャ</h1>
      <p>今日残り回数: {dailyCount}</p>

      {challenge && (
        <div className="bg-white p-4 my-4 rounded shadow">
          <p className="text-lg">{challenge}</p>
          {timer > 0 && <p className="mt-2 text-red-500">残り {timer} 秒</p>}
        </div>
      )}

      <div className="flex flex-col items-center gap-2 mt-6">
        <button
          onClick={drawBook}
          className="bg-pink-400 hover:bg-pink-500 text-white px-4 py-2 rounded"
        >
          ガチャを回す
        </button>
        <button
          onClick={() => {
            setChallenge("");
            if (intervalId) clearInterval(intervalId);
            setTimer(0);
          }}
          className="bg-green-400 hover:bg-green-500 text-white px-4 py-2 rounded"
        >
          完了
        </button>
      </div>
    </div>
  );
}

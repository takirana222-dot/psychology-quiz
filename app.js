// ==========================================================
// 心理学クイズ道場 - アプリロジック
// LocalStorageのみで完結（バックエンド不要）
// ==========================================================

const STORAGE_KEY = "psychQuizProgress_v1";
const ROUND_NAMES = {
  1: "第1回 心理学とは", 2: "第2回 知覚心理学", 3: "第3回 学習心理学",
  4: "第4回 記憶と認知", 5: "第5回 感情と動機づけ", 6: "第6回 性格心理学",
  7: "第7回 生理心理学", 8: "第8回 ポジティブ/健康", 9: "第9回 教育心理学",
  10: "第10回 臨床心理学", 11: "第11回 コミュニケーション", 12: "第12回 色彩/音楽",
  13: "第13回 社会心理学①", 14: "第14回 社会心理学②"
};
const ESSAY_HINT_TEXT = {
  A: "💡 この問題のテーマ（対人認知・印象形成）は、自由記述問題の理解の土台になります。",
  B: "💡 この問題のテーマ（発達と支援の関係）は、自由記述問題の理解の土台になります。"
};

// ---------- 状態管理 ----------
function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultProgress();
    const parsed = JSON.parse(raw);
    return Object.assign(defaultProgress(), parsed);
  } catch (e) {
    return defaultProgress();
  }
}
function defaultProgress() {
  return {
    records: {},     // { [questionId]: { correctCount, wrongCount, lastCorrect: bool, answered: bool } }
    bookmarks: {},    // { [questionId]: true }
  };
}
function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
}

let state = {
  progress: loadProgress(),
  currentQueue: [],   // array of question objects (already shuffled, choices shuffled)
  currentIndex: 0,
  sessionCorrect: 0,
  sessionWrong: 0,
  sessionLabel: "",
  answeredThisQ: false
};

// ---------- ユーティリティ ----------
function shuffleArray(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildShuffledQuestion(original) {
  // 選択肢シャッフル。正解インデックスを付け替える
  const choiceObjs = original.choices.map((text, idx) => ({ text, isCorrect: idx === original.ans }));
  const shuffled = shuffleArray(choiceObjs);
  return {
    id: original.id,
    round: original.round,
    q: original.q,
    explain: original.explain,
    essay: original.essay,
    choices: shuffled.map(c => c.text),
    correctIndex: shuffled.findIndex(c => c.isCorrect)
  };
}

function getRecord(id) {
  if (!state.progress.records[id]) {
    state.progress.records[id] = { correctCount: 0, wrongCount: 0, lastCorrect: null, answered: false };
  }
  return state.progress.records[id];
}

function isBookmarked(id) {
  return !!state.progress.bookmarks[id];
}

function toggleBookmark(id) {
  if (state.progress.bookmarks[id]) {
    delete state.progress.bookmarks[id];
  } else {
    state.progress.bookmarks[id] = true;
  }
  saveProgress();
}

// ---------- 集計 ----------
function computeOverallStats() {
  const total = QUESTIONS.length;
  let answered = 0, correct = 0, wrong = 0;
  QUESTIONS.forEach(q => {
    const r = state.progress.records[q.id];
    if (r && r.answered) {
      answered++;
      if (r.lastCorrect) correct++; else wrong++;
    }
  });
  const bookmarkCount = Object.keys(state.progress.bookmarks).length;
  return { total, answered, correct, wrong, bookmarkCount };
}

function computeRoundStats(round) {
  const qs = QUESTIONS.filter(q => q.round === round);
  let answered = 0, correct = 0;
  qs.forEach(q => {
    const r = state.progress.records[q.id];
    if (r && r.answered) {
      answered++;
      if (r.lastCorrect) correct++;
    }
  });
  return { total: qs.length, answered, correct };
}

// ---------- 画面遷移 ----------
const screens = {
  home: document.getElementById("screenHome"),
  roundSelect: document.getElementById("screenRoundSelect"),
  quiz: document.getElementById("screenQuiz"),
  result: document.getElementById("screenResult"),
};
function showScreen(name) {
  Object.values(screens).forEach(s => s.hidden = true);
  screens[name].hidden = false;
  window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
}

// ---------- ホーム画面描画 ----------
function renderHome() {
  const stats = computeOverallStats();
  document.getElementById("progressText").textContent = `${stats.answered} / ${stats.total} 問`;
  document.getElementById("progressBarFill").style.width = `${(stats.answered / stats.total) * 100}%`;
  document.getElementById("summaryCorrect").textContent = stats.correct;
  document.getElementById("summaryWrong").textContent = stats.wrong;
  document.getElementById("summaryBookmark").textContent = stats.bookmarkCount;
  document.getElementById("bookmarkCountText").textContent = `${stats.bookmarkCount}問`;

  document.getElementById("headerAccuracy").textContent =
    stats.answered > 0 ? `${Math.round((stats.correct / stats.answered) * 100)}%` : "--%";
  document.getElementById("headerAnswered").textContent = `${stats.answered}/${stats.total}`;

  const roundList = document.getElementById("roundProgressList");
  roundList.innerHTML = "";
  Object.keys(ROUND_NAMES).map(Number).sort((a, b) => a - b).forEach(round => {
    const rs = computeRoundStats(round);
    const pct = rs.total > 0 ? (rs.answered / rs.total) * 100 : 0;
    const row = document.createElement("div");
    row.className = "round-progress-row";
    row.innerHTML = `
      <div class="rp-label">第${round}回</div>
      <div class="rp-track"><div class="rp-fill" style="width:${pct}%"></div></div>
      <div class="rp-count">${rs.answered}/${rs.total}</div>
    `;
    roundList.appendChild(row);
  });
}

// ---------- 回選択画面 ----------
function renderRoundSelect() {
  const list = document.getElementById("roundSelectList");
  list.innerHTML = "";
  Object.keys(ROUND_NAMES).map(Number).sort((a, b) => a - b).forEach(round => {
    const count = QUESTIONS.filter(q => q.round === round).length;
    const rs = computeRoundStats(round);
    const item = document.createElement("div");
    item.className = "round-select-item";
    item.innerHTML = `
      <div class="rsi-left">
        <div class="rsi-title">${ROUND_NAMES[round]}</div>
        <div class="rsi-sub">全${count}問・解答済み${rs.answered}問</div>
      </div>
      <button class="rsi-btn" data-round="${round}">出題</button>
    `;
    list.appendChild(item);
  });
  list.querySelectorAll(".rsi-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const round = Number(btn.dataset.round);
      startQuiz(QUESTIONS.filter(q => q.round === round), `${ROUND_NAMES[round]}`);
    });
  });
}

// ---------- クイズ開始 ----------
function startQuiz(sourceQuestions, label) {
  if (sourceQuestions.length === 0) {
    alert("出題できる問題がありません。条件を変えてお試しください。");
    return;
  }
  const shuffledOrder = shuffleArray(sourceQuestions);
  state.currentQueue = shuffledOrder.map(buildShuffledQuestion);
  state.currentIndex = 0;
  state.sessionCorrect = 0;
  state.sessionWrong = 0;
  state.sessionLabel = label;
  showScreen("quiz");
  renderQuizQuestion();
}

function renderQuizQuestion() {
  state.answeredThisQ = false;
  const total = state.currentQueue.length;
  const idx = state.currentIndex;
  const q = state.currentQueue[idx];

  document.getElementById("quizIndex").textContent = idx + 1;
  document.getElementById("quizTotal").textContent = total;
  document.getElementById("quizProgressFill").style.width = `${((idx) / total) * 100}%`;

  document.getElementById("quizRoundBadge").textContent = ROUND_NAMES[q.round].split(" ")[0];
  document.getElementById("quizQuestion").textContent = q.q;

  const bmBtn = document.getElementById("quizBookmarkBtn");
  bmBtn.classList.toggle("active", isBookmarked(q.id));
  bmBtn.onclick = () => {
    toggleBookmark(q.id);
    bmBtn.classList.toggle("active", isBookmarked(q.id));
    renderHome();
  };

  const choiceList = document.getElementById("choiceList");
  choiceList.innerHTML = "";
  const marks = ["①", "②", "③", "④"];
  q.choices.forEach((choiceText, i) => {
    const div = document.createElement("button");
    div.className = "choice-item";
    div.innerHTML = `<span class="choice-mark">${marks[i]}</span><span>${choiceText}</span>`;
    div.addEventListener("click", () => handleAnswer(i));
    choiceList.appendChild(div);
  });

  document.getElementById("feedbackPanel").hidden = true;
}

function handleAnswer(selectedIndex) {
  if (state.answeredThisQ) return;
  state.answeredThisQ = true;

  const q = state.currentQueue[state.currentIndex];
  const isCorrect = selectedIndex === q.correctIndex;

  const items = document.querySelectorAll(".choice-item");
  items.forEach((item, i) => {
    item.classList.add("disabled");
    if (i === q.correctIndex) item.classList.add("correct");
    if (i === selectedIndex && !isCorrect) item.classList.add("wrong");
  });

  // 記録を更新
  const record = getRecord(q.id);
  record.answered = true;
  record.lastCorrect = isCorrect;
  if (isCorrect) { record.correctCount++; state.sessionCorrect++; }
  else { record.wrongCount++; state.sessionWrong++; }
  saveProgress();

  // フィードバック表示
  const badge = document.getElementById("feedbackBadge");
  badge.textContent = isCorrect ? "◎ 正解！" : "✕ 不正解";
  badge.className = "feedback-badge " + (isCorrect ? "correct" : "wrong");

  let explainHtml = q.explain;
  if (q.essay) {
    explainHtml += `<br><br><span style="color:#2b74b8;font-weight:700;">${ESSAY_HINT_TEXT[q.essay]}</span>`;
  }
  document.getElementById("feedbackExplain").innerHTML = explainHtml;

  document.getElementById("feedbackPanel").hidden = false;
  document.getElementById("feedbackPanel").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

document.getElementById("btnNext").addEventListener("click", () => {
  const total = state.currentQueue.length;
  if (state.currentIndex < total - 1) {
    state.currentIndex++;
    renderQuizQuestion();
  } else {
    document.getElementById("quizProgressFill").style.width = `100%`;
    showResult();
  }
});

function showResult() {
  const correct = state.sessionCorrect;
  const total = state.currentQueue.length;
  const pct = Math.round((correct / total) * 100);

  document.getElementById("resultScore").textContent = `${correct} / ${total}`;

  let emoji = "🌱", title = "また挑戦しよう", comment = "少しずつ積み重ねていこう。";
  if (pct === 100) { emoji = "🏆"; title = "パーフェクト！"; comment = "全問正解です。理解が定着しています。"; }
  else if (pct >= 80) { emoji = "🎉"; title = "よくできました！"; comment = "この調子で他の範囲も進めましょう。"; }
  else if (pct >= 60) { emoji = "📘"; title = "あと少し！"; comment = "間違えた問題をブックマークして復習しましょう。"; }
  else { emoji = "🌱"; title = "伸びしろあり！"; comment = "焦らず、間違えた問題から重点的に復習しましょう。"; }

  document.getElementById("resultEmoji").textContent = emoji;
  document.getElementById("resultTitle").textContent = title;
  document.getElementById("resultComment").textContent = comment;

  showScreen("result");
}

// ---------- ボタンイベント ----------
document.getElementById("btnHome").addEventListener("click", () => { renderHome(); showScreen("home"); });
document.getElementById("btnBackHome").addEventListener("click", () => { renderHome(); showScreen("home"); });
document.getElementById("btnQuitQuiz").addEventListener("click", () => {
  if (confirm("クイズを中断してホームへ戻りますか？")) { renderHome(); showScreen("home"); }
});

document.getElementById("btnStartAll").addEventListener("click", () => {
  startQuiz(QUESTIONS, "ランダム出題（全85問）");
});

document.getElementById("btnStartBookmark").addEventListener("click", () => {
  const bookmarked = QUESTIONS.filter(q => isBookmarked(q.id));
  if (bookmarked.length === 0) {
    alert("ブックマークした問題がまだありません。クイズ中に🔖ボタンで登録できます。");
    return;
  }
  startQuiz(bookmarked, "ブックマーク復習");
});

document.getElementById("btnStartWrong").addEventListener("click", () => {
  const notMastered = QUESTIONS.filter(q => {
    const r = state.progress.records[q.id];
    return !r || !r.answered || !r.lastCorrect;
  });
  if (notMastered.length === 0) {
    alert("すべての問題に正解済みです！お見事です。");
    return;
  }
  startQuiz(notMastered, "苦手問題（未正解）");
});

document.getElementById("btnStartByRound").addEventListener("click", () => {
  renderRoundSelect();
  showScreen("roundSelect");
});
document.getElementById("btnBackFromRoundSelect").addEventListener("click", () => {
  renderHome(); showScreen("home");
});

document.getElementById("btnRetrySame").addEventListener("click", () => {
  // 同じ問題集合を再シャッフルして再挑戦
  const ids = new Set(state.currentQueue.map(q => q.id));
  const sourceQuestions = QUESTIONS.filter(q => ids.has(q.id));
  startQuiz(sourceQuestions, state.sessionLabel);
});

document.getElementById("btnReset").addEventListener("click", () => {
  if (confirm("学習データ（正答率・ブックマークなど）をすべて削除します。よろしいですか？")) {
    state.progress = defaultProgress();
    saveProgress();
    renderHome();
  }
});

// ---------- 初期化 ----------
renderHome();
showScreen("home");

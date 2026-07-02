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
const COUNT_OPTIONS = [10, 20, 40, 60, 85];

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
  return { records: {}, bookmarks: {} };
}
function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
}

let state = {
  progress: loadProgress(),
  currentQueue: [],
  currentIndex: 0,
  sessionCorrect: 0,
  sessionWrong: 0,
  sessionLabel: "",
  sessionAnswers: [],
  answeredThisQ: false,
  // ホーム画面：問題セット＆問題数の選択状態
  home: {
    setType: "all",     // "all" | "wrong" | "round" | "bookmark"
    round: null,
    count: null
  }
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
function isBookmarked(id) { return !!state.progress.bookmarks[id]; }
function toggleBookmark(id) {
  if (state.progress.bookmarks[id]) delete state.progress.bookmarks[id];
  else state.progress.bookmarks[id] = true;
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
    if (r && r.answered) { answered++; if (r.lastCorrect) correct++; }
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
  window.scrollTo({ top: 0, behavior: "auto" });
}

// ---------- ホーム画面：問題セットの解決 ----------
function getSourceQuestionsForHomeSelection() {
  switch (state.home.setType) {
    case "all":
      return { list: QUESTIONS, label: "ランダム出題（全体）" };
    case "wrong": {
      const list = QUESTIONS.filter(q => {
        const r = state.progress.records[q.id];
        return !r || !r.answered || !r.lastCorrect;
      });
      return { list, label: "苦手問題（未正解）" };
    }
    case "round": {
      const round = state.home.round;
      const list = round ? QUESTIONS.filter(q => q.round === round) : [];
      return { list, label: round ? ROUND_NAMES[round] : "回を選択してください" };
    }
    case "bookmark": {
      const list = QUESTIONS.filter(q => isBookmarked(q.id));
      return { list, label: "保存した問題" };
    }
    default:
      return { list: [], label: "" };
  }
}

// ---------- ホーム画面描画 ----------
function renderHome() {
  const stats = computeOverallStats();
  document.getElementById("statAnswered").textContent = stats.answered;
  document.getElementById("statCorrect").textContent = stats.correct;
  document.getElementById("statAccuracy").textContent =
    stats.answered > 0 ? `${Math.round((stats.correct / stats.answered) * 100)}%` : "—";
  document.getElementById("progressText").textContent = `${stats.answered} / ${stats.total}問`;
  document.getElementById("progressBarFill").style.width = `${(stats.answered / stats.total) * 100}%`;
  document.getElementById("bookmarkCountText").textContent = `${stats.bookmarkCount}問`;

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

  renderSetSelectionUI();
  renderCountGrid();
  renderStartButton();
}

// ---------- 問題セット選択UI ----------
function renderSetSelectionUI() {
  const map = {
    all: document.getElementById("btnSetAll"),
    wrong: document.getElementById("btnSetWrong"),
    round: document.getElementById("btnSetByRound"),
  };
  Object.entries(map).forEach(([type, el]) => {
    el.classList.toggle("is-selected", state.home.setType === type);
  });
  document.getElementById("btnStartBookmark").classList.toggle("is-selected", state.home.setType === "bookmark");

  // 「回ごとに選ぶ」の説明文を、選択中の回に応じて更新
  const roundDesc = map.round.querySelector(".set-select-desc");
  if (state.home.setType === "round" && state.home.round) {
    roundDesc.textContent = `${ROUND_NAMES[state.home.round]}（変更する場合は再度タップ）`;
  } else {
    roundDesc.textContent = "第1回〜第14回から選択";
  }
}

function selectSet(type) {
  if (type === "round") {
    renderRoundSelect();
    showScreen("roundSelect");
    return;
  }
  state.home.setType = type;
  state.home.round = null;
  state.home.count = null;
  renderHome();
}

document.getElementById("btnSetAll").addEventListener("click", () => selectSet("all"));
document.getElementById("btnSetWrong").addEventListener("click", () => selectSet("wrong"));
document.getElementById("btnSetByRound").addEventListener("click", () => selectSet("round"));
document.getElementById("btnStartBookmark").addEventListener("click", () => selectSet("bookmark"));

// ---------- 問題数選択グリッド ----------
function renderCountGrid() {
  const { list } = getSourceQuestionsForHomeSelection();
  const available = list.length;
  const grid = document.getElementById("homeCountGrid");
  grid.innerHTML = "";

  if (available === 0) {
    grid.innerHTML = `<div style="grid-column: span 3; text-align:center; color:var(--ink-soft); font-size:12.5px; padding:14px 0;">この範囲には出題できる問題がありません</div>`;
    return;
  }

  let options = COUNT_OPTIONS.filter(c => c <= available);
  if (!options.includes(available)) options.push(available);
  options = [...new Set(options)].sort((a, b) => a - b);

  options.forEach(n => {
    const isAll = n === available;
    const card = document.createElement("button");
    card.className = "count-card" + (state.home.count === n ? " is-selected" : "");
    card.innerHTML = `
      <div class="count-card-num">${n}</div>
      <div class="count-card-unit">問</div>
      ${isAll ? '<div class="count-card-tag">全問</div>' : ""}
    `;
    card.addEventListener("click", () => {
      state.home.count = n;
      renderCountGrid();
      renderStartButton();
    });
    grid.appendChild(card);
  });
}

// ---------- スタートボタン ----------
function renderStartButton() {
  const btn = document.getElementById("btnHomeStart");
  const { list, label } = getSourceQuestionsForHomeSelection();

  if (list.length === 0) {
    btn.disabled = true;
    btn.classList.remove("is-ready");
    btn.textContent = state.home.setType === "round" && !state.home.round
      ? "まず回を選んでください"
      : "出題できる問題がありません";
    return;
  }
  if (!state.home.count) {
    btn.disabled = true;
    btn.classList.remove("is-ready");
    btn.textContent = "問題数を選んでください";
    return;
  }
  btn.disabled = false;
  btn.classList.add("is-ready");
  btn.textContent = `${label}で ${state.home.count}問 スタート`;
}

document.getElementById("btnHomeStart").addEventListener("click", () => {
  const { list, label } = getSourceQuestionsForHomeSelection();
  if (list.length === 0 || !state.home.count) return;
  startQuiz(list, label, state.home.count);
});

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
      <button class="rsi-btn" data-round="${round}">選ぶ</button>
    `;
    list.appendChild(item);
  });
  list.querySelectorAll(".rsi-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const round = Number(btn.dataset.round);
      state.home.setType = "round";
      state.home.round = round;
      state.home.count = null;
      renderHome();
      showScreen("home");
    });
  });
}
document.getElementById("btnBackFromRoundSelect").addEventListener("click", () => {
  renderHome(); showScreen("home");
});

// ---------- クイズ開始 ----------
function startQuiz(sourceQuestions, label, count) {
  if (sourceQuestions.length === 0) {
    alert("出題できる問題がありません。条件を変えてお試しください。");
    return;
  }
  const shuffledOrder = shuffleArray(sourceQuestions);
  const limited = count ? shuffledOrder.slice(0, count) : shuffledOrder;
  state.currentQueue = limited.map(buildShuffledQuestion);
  state.currentIndex = 0;
  state.sessionCorrect = 0;
  state.sessionWrong = 0;
  state.sessionLabel = label;
  state.sessionAnswers = [];
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

  const record = getRecord(q.id);
  record.answered = true;
  record.lastCorrect = isCorrect;
  if (isCorrect) { record.correctCount++; state.sessionCorrect++; }
  else { record.wrongCount++; state.sessionWrong++; }
  saveProgress();

  state.sessionAnswers.push({
    id: q.id, round: q.round, q: q.q, choices: q.choices,
    correctIndex: q.correctIndex, userIndex: selectedIndex, isCorrect,
    explain: q.explain, essay: q.essay
  });

  const badge = document.getElementById("feedbackBadge");
  badge.textContent = isCorrect ? "◎ 正解！" : "✕ 不正解";
  badge.className = "feedback-badge " + (isCorrect ? "correct" : "wrong");

  let explainHtml = q.explain;
  if (q.essay) {
    explainHtml += `<br><br><span style="color:#2f5bc7;font-weight:700;">${ESSAY_HINT_TEXT[q.essay]}</span>`;
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

  renderResultReviewList();
  showScreen("result");
}

function renderResultReviewList() {
  const listEl = document.getElementById("resultReviewList");
  listEl.innerHTML = "";
  const marks = ["①", "②", "③", "④"];

  state.sessionAnswers.forEach((ans, idx) => {
    const item = document.createElement("div");
    item.className = "review-item" + (ans.isCorrect ? "" : " wrong");
    item.dataset.qid = ans.id;

    const head = document.createElement("div");
    head.className = "review-item-head";
    head.innerHTML = `
      <div class="review-mark">${ans.isCorrect ? "◎" : "✕"}</div>
      <div class="review-item-body-text">
        <div class="review-round-tag">${ROUND_NAMES[ans.round].split(" ")[0]}</div>
        <div class="review-q-text">${idx + 1}. ${ans.q}</div>
      </div>
      <button class="review-bm-btn ${isBookmarked(ans.id) ? "active" : ""}" aria-label="ブックマーク">
        <svg class="bm-icon-small" viewBox="0 0 24 24"><path d="M6 3a2 2 0 0 0-2 2v16l8-5 8 5V5a2 2 0 0 0-2-2H6z"/></svg>
      </button>
      <span class="review-caret">▼</span>
    `;

    const detail = document.createElement("div");
    detail.className = "review-item-detail";
    let choicesHtml = "";
    ans.choices.forEach((choiceText, i) => {
      let cls = "review-detail-choice";
      if (i === ans.correctIndex) cls += " is-correct";
      else if (i === ans.userIndex) cls += " is-user-wrong";
      choicesHtml += `<div class="${cls}">${marks[i]} ${choiceText}${i === ans.correctIndex ? "（正解）" : (i === ans.userIndex ? "（あなたの解答）" : "")}</div>`;
    });
    let explainHtml = ans.explain;
    if (ans.essay) {
      explainHtml += `<br><br><span style="color:#2f5bc7;font-weight:700;">${ESSAY_HINT_TEXT[ans.essay]}</span>`;
    }
    detail.innerHTML = `${choicesHtml}<div class="review-detail-explain">${explainHtml}</div>`;

    item.appendChild(head);
    item.appendChild(detail);
    listEl.appendChild(item);

    head.addEventListener("click", (e) => {
      if (e.target.closest(".review-bm-btn")) return;
      item.classList.toggle("expanded");
    });

    const bmBtn = head.querySelector(".review-bm-btn");
    bmBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleBookmark(ans.id);
      bmBtn.classList.toggle("active", isBookmarked(ans.id));
    });
  });
}

// ---------- ボタンイベント ----------
document.getElementById("btnBackHome").addEventListener("click", () => { renderHome(); showScreen("home"); });
document.getElementById("btnQuitQuiz").addEventListener("click", () => {
  if (confirm("クイズを中断してホームへ戻りますか？")) { renderHome(); showScreen("home"); }
});
document.getElementById("btnRetrySame").addEventListener("click", () => {
  const ids = new Set(state.currentQueue.map(q => q.id));
  const sourceQuestions = QUESTIONS.filter(q => ids.has(q.id));
  startQuiz(sourceQuestions, state.sessionLabel, sourceQuestions.length);
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

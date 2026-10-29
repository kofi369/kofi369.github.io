const $ = (id) => document.getElementById(id);
const STORAGE_KEY = "word-cards-v1";

let words = [];
let currentWordId = null;
let isFlipped = false;
let sessionSeen = new Set();
let recentIds = [];
let sessionTarget = 10;
let sessionDone = 0;
let sessionCorrect = 0;
let sessionWrong = 0;
let editingId = null;
let toastTimer = null;

function makeId() {
  return (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
}
function loadWords() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (Array.isArray(parsed)) {
      words = parsed.filter(w => w && w.en && w.ru).map(w => ({
        id: String(w.id || makeId()), en: String(w.en).trim(), ru: String(w.ru).trim(),
        level: Math.max(0, Math.min(5, Number.parseInt(w.level, 10) || 0))
      }));
    }
  } catch { words = []; }
  if (!words.length) {
    words = [
      {id: makeId(), en:"to improve", ru:"улучшать", level:0},
      {id: makeId(), en:"reliable", ru:"надёжный", level:0},
      {id: makeId(), en:"to avoid", ru:"избегать", level:0},
      {id: makeId(), en:"achievement", ru:"достижение", level:0},
      {id: makeId(), en:"to hesitate", ru:"колебаться", level:0}
    ];
    saveWords();
  }
}
function saveWords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(words));
  $("wordCount").textContent = words.length;
}
function showToast(message) {
  $("toast").textContent = message;
  $("toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").classList.remove("show"), 2400);
}
function setTab(name) {
  document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b.dataset.tab === name));
  $("studyPanel").classList.toggle("hidden", name !== "study");
  $("wordsPanel").classList.toggle("hidden", name !== "words");
  $("settingsPanel").classList.add("hidden");
}
document.querySelectorAll(".tab").forEach(b => b.addEventListener("click", () => setTab(b.dataset.tab)));

function targetCount() {
  const size = $("sessionSize").value;
  return size === "all" ? words.length : Math.min(Number(size), words.length);
}
function chooseWord() {
  let available = words.filter(w => !sessionSeen.has(w.id));
  if (!available.length) {
    sessionSeen.clear();
    available = [...words];
  }
  if (available.length > 2) {
    const noRecent = available.filter(w => !recentIds.slice(-2).includes(w.id));
    if (noRecent.length) available = noRecent;
  }
  if ($("weightedMode").checked) {
    const weights = available.map(w => 1 + w.level * 2);
    const sum = weights.reduce((a,b) => a+b, 0);
    let pick = Math.random() * sum;
    for (let i=0; i<available.length; i++) {
      pick -= weights[i];
      if (pick <= 0) return available[i];
    }
  }
  return available[Math.floor(Math.random() * available.length)];
}
function startSession() {
  sessionDone = 0; sessionCorrect = 0; sessionWrong = 0;
  sessionSeen = new Set(); recentIds = [];
  sessionTarget = targetCount();
  if (!words.length) {
    currentWordId = null; renderCard(); updateProgress(); return;
  }
  nextCard();
}
function currentWord() { return words.find(w => w.id === currentWordId) || null; }
function nextCard() {
  if (!words.length) { currentWordId = null; renderCard(); updateProgress(); return; }
  const w = chooseWord();
  currentWordId = w.id;
  sessionSeen.add(w.id);
  recentIds.push(w.id);
  isFlipped = false;
  renderCard(); updateProgress();
}
function previousCard() {
  if (recentIds.length < 2) return;
  const currentId = recentIds.pop();
  sessionSeen.delete(currentId);
  currentWordId = recentIds[recentIds.length - 1];
  isFlipped = false;
  renderCard(); updateProgress();
}
function renderCard() {
  const w = currentWord();
  if (!w) { $("cardText").textContent = "Добавь первое слово"; return; }
  const front = $("direction").value === "en_ru" ? w.en : w.ru;
  const back = $("direction").value === "en_ru" ? w.ru : w.en;
  $("cardText").textContent = isFlipped ? back : front;
  $("flashcard").setAttribute("aria-label", isFlipped ? "Показан перевод, нажми чтобы вернуться" : "Нажми, чтобы увидеть перевод");
}
$("flashcard").addEventListener("click", () => {
  if (!currentWord()) return;
  isFlipped = !isFlipped; renderCard();
});
$("direction").addEventListener("change", () => { isFlipped = false; renderCard(); });
$("sessionSize").addEventListener("change", startSession);
$("weightedMode").addEventListener("change", () => showToast($("weightedMode").checked ? "Сложные слова будут чаще появляться" : "Слова будут выбираться равномерно"));
$("nextBtn").addEventListener("click", nextCard);
$("prevBtn").addEventListener("click", previousCard);
$("restartBtn").addEventListener("click", startSession);

function answer(known) {
  const w = currentWord();
  if (!w) { showToast("Сначала добавь слова"); return; }
  if (known) {
    w.level = Math.max(0, w.level - 1);
    sessionCorrect++;
  } else {
    w.level = Math.min(5, w.level + 1);
    sessionWrong++;
  }
  sessionDone++;
  saveWords(); renderWordList();
  if (sessionDone >= sessionTarget) finishSession();
  else nextCard();
}
$("knownBtn").addEventListener("click", () => answer(true));
$("hardBtn").addEventListener("click", () => answer(false));
function finishSession() {
  const total = sessionCorrect + sessionWrong;
  const percent = total ? Math.round(sessionCorrect / total * 100) : 0;
  $("resultSummary").textContent = `Просмотрено карточек: ${total}.`;
  $("scorePercent").textContent = `${percent}%`;
  $("scoreDetail").textContent = `Правильных ответов: ${sessionCorrect} из ${total}`;
  $("resultDialog").showModal();
}
$("continueBtn").addEventListener("click", () => {
  $("resultDialog").close();
  startSession();
});
function updateProgress() {
  if (!words.length) { $("progressText").textContent = "Добавь слова, чтобы начать"; return; }
  const shown = Math.min(sessionDone + 1, sessionTarget);
  $("progressText").textContent = `Карточка ${shown} из ${sessionTarget} • Всего слов: ${words.length}`;
}

function renderWordList() {
  const list = $("wordList");
  list.replaceChildren();
  $("emptyWords").classList.toggle("hidden", words.length > 0);
  $("wordCount").textContent = words.length;
  words.forEach(w => {
    const item = document.createElement("div");
    item.className = "word-item";
    const pair = document.createElement("div");
    pair.className = "word-pair";
    const en = document.createElement("div"); en.className = "word-en"; en.textContent = w.en;
    const ru = document.createElement("div"); ru.className = "word-ru"; ru.textContent = w.ru;
    const level = document.createElement("div"); level.className = "word-level"; level.textContent = w.level ? "★".repeat(w.level) : "Без отметки сложности";
    pair.append(en, ru, level);
    const edit = document.createElement("button"); edit.className = "small-action"; edit.textContent = "Изменить";
    edit.addEventListener("click", () => {
      editingId = w.id; $("englishInput").value = w.en; $("russianInput").value = w.ru;
      $("saveWordBtn").textContent = "Сохранить"; $("cancelEditBtn").classList.remove("hidden");
      $("englishInput").focus(); window.scrollTo({top:0, behavior:"smooth"});
    });
    const del = document.createElement("button"); del.className = "small-action delete"; del.textContent = "×";
    del.setAttribute("aria-label", `Удалить ${w.en}`);
    del.addEventListener("click", () => {
      if (!confirm(`Удалить «${w.en} — ${w.ru}»?`)) return;
      words = words.filter(x => x.id !== w.id);
      if (currentWordId === w.id) currentWordId = null;
      saveWords(); renderWordList(); startSession(); showToast("Слово удалено");
    });
    item.append(pair, edit, del); list.append(item);
  });
}
function clearForm() {
  $("englishInput").value = ""; $("russianInput").value = "";
  editingId = null; $("saveWordBtn").textContent = "Добавить слово";
  $("cancelEditBtn").classList.add("hidden");
}
$("cancelEditBtn").addEventListener("click", clearForm);
$("wordForm").addEventListener("submit", e => {
  e.preventDefault();
  const en = $("englishInput").value.trim(), ru = $("russianInput").value.trim();
  if (!en || !ru) return;
  const duplicate = words.some(w => w.id !== editingId && w.en.toLowerCase() === en.toLowerCase() && w.ru.toLowerCase() === ru.toLowerCase());
  if (duplicate) { showToast("Такая пара уже есть"); return; }
  if (editingId) {
    const w = words.find(x => x.id === editingId);
    if (w) { w.en = en; w.ru = ru; }
    showToast("Изменения сохранены");
  } else {
    words.push({id:makeId(), en, ru, level:0});
    showToast("Слово добавлено");
  }
  saveWords(); renderWordList(); clearForm(); startSession();
});
function exportWords() {
  const blob = new Blob([JSON.stringify(words, null, 2)], {type:"application/json;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "words.json"; a.click();
  URL.revokeObjectURL(url);
  showToast("Подготовлен файл словаря");
}
function importWordsFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data)) throw new Error("Файл должен содержать список слов");
      const imported = data.filter(w => w && typeof w.en === "string" && typeof w.ru === "string" && w.en.trim() && w.ru.trim())
        .map(w => ({id:makeId(), en:w.en.trim(), ru:w.ru.trim(), level:Math.max(0, Math.min(5, Number.parseInt(w.level,10)||0))}));
      if (!imported.length) throw new Error("В файле не найдено слов с полями en и ru");
      const replace = confirm(`Найдено слов: ${imported.length}.\nОК — заменить текущий словарь.\nОтмена — добавить к текущему.`);
      if (replace) words = imported;
      else {
        for (const w of imported) {
          if (!words.some(x => x.en.toLowerCase() === w.en.toLowerCase() && x.ru.toLowerCase() === w.ru.toLowerCase())) words.push(w);
        }
      }
      saveWords(); renderWordList(); startSession();
      showToast(`Импортировано слов: ${imported.length}`);
    } catch (err) { alert(`Не удалось импортировать файл.\n${err.message || "Проверь формат JSON."}`); }
    $("importFile").value = "";
  };
  reader.readAsText(file, "utf-8");
}
$("importBtn").addEventListener("click", () => $("importFile").click());
$("settingsImportBtn").addEventListener("click", () => $("importFile").click());
$("importFile").addEventListener("change", e => importWordsFile(e.target.files[0]));
$("exportBtn").addEventListener("click", exportWords);
$("settingsExportBtn").addEventListener("click", exportWords);

$("openSettings").addEventListener("click", () => {
  $("studyPanel").classList.add("hidden"); $("wordsPanel").classList.add("hidden");
  $("settingsPanel").classList.remove("hidden");
  document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
});
$("closeSettings").addEventListener("click", () => setTab("study"));

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").catch(() => {}));
}
loadWords(); saveWords(); renderWordList(); startSession();

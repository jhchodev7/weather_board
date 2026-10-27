// app.js – 화면 동작 (목록 그리기, 일정 추가)

let baseTasks = [];         // data/tasks.json 에서 읽은 기본 일정
let baseLoadFailed = false; // 더블클릭(file://)으로 열면 JSON을 못 읽음
let tasks = [];
let weatherByRegion = {};   // 03 단원에서 지역별 날씨를 넣음

// 기본 일정을 JSON 파일에서 한 번 읽음
async function loadBaseTasks() {
  try {
    const res = await fetch('data/tasks.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    baseTasks = await res.json();
  } catch (err) {
    baseLoadFailed = true;
  }
}

// JSON 일정 먼저, 화면에서 추가한 일정(브라우저 저장)은 그 뒤에
function loadTasks() {
  const saved = JSON.parse(localStorage.getItem('wx_added') || '[]');
  tasks = baseTasks.concat(saved);
}

// 오늘 날짜를 YYYY-MM-DD 로 (PC 시계 기준 현지 날짜)
function todayText() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

function renderToday() {
  document.getElementById('todayDate').textContent = todayText();
}

function weatherText(w) {
  return w ? w.tempMax + '℃ · ' + w.windMax + 'm/s · ' + w.rainProb + '%' : '-';
}

function renderTasks() {
  const body = document.getElementById('taskList');
  body.innerHTML = '';
  if (baseLoadFailed) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 6;
    td.className = 'stop';
    td.textContent = '일정 파일을 읽지 못했습니다. 배포 주소로 열어 주세요.';
    tr.appendChild(td);
    body.appendChild(tr);
  }
  for (const t of tasks) {
    const w = weatherByRegion[t.region];
    const r = judge(t.kind, w);
    const tr = document.createElement('tr');
    for (const v of [t.title, t.region, t.kind, t.owner, weatherText(w)]) {
      const td = document.createElement('td');
      td.textContent = v;
      tr.appendChild(td);
    }
    const td = document.createElement('td');
    td.textContent = r.text;
    td.className = r.level;
    tr.appendChild(td);
    body.appendChild(tr);
  }
}

function addTask(e) {
  e.preventDefault();
  const t = {
    title: document.getElementById('titleInput').value.trim(),
    region: document.getElementById('regionInput').value,
    kind: document.getElementById('kindInput').value,
    owner: document.getElementById('ownerInput').value.trim(),
  };
  if (!t.title || !t.owner) return;
  const saved = JSON.parse(localStorage.getItem('wx_added') || '[]');
  saved.push(t);
  localStorage.setItem('wx_added', JSON.stringify(saved));
  e.target.reset();
  loadTasks();
  renderTasks();
}

// 지역별 날씨를 받아 표를 다시 그림 (실패해도 목록은 그대로)
async function loadWeather() {
  const box = document.getElementById('weatherBox');
  try {
    const res = await fetch(buildWeatherUrl(REGIONS));
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const mode = new URLSearchParams(location.search).get('test');
    weatherByRegion = applyTestMode(parseWeather(await res.json(), REGIONS), mode);
    box.textContent = '오늘 날씨 (최고 기온 · 최대 풍속 · 강수확률, Open-Meteo)'
      + (mode === 'wind' ? ' – 시험 모드: 풍속 12m/s' : '');
  } catch (err) {
    box.textContent = '날씨를 불러오지 못했습니다. 판단은 날씨 확인 전으로 표시합니다.';
  }
  renderTasks();
}

// 지금 표를 md 파일로 내려받음
function saveMarkdown() {
  const rows = tasks.map(t => {
    const w = weatherByRegion[t.region];
    return [t.title, t.region, t.kind, t.owner, weatherText(w), judge(t.kind, w).text];
  });
  const md = buildJudgeMarkdown(todayText(), rows);
  const url = URL.createObjectURL(new Blob([md], { type: 'text/markdown;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = '현장일정_판단_' + todayText() + '.md';
  a.click();
  URL.revokeObjectURL(url);
}

document.getElementById('taskForm').addEventListener('submit', addTask);
document.getElementById('saveMdBtn').addEventListener('click', saveMarkdown);
renderToday();
loadWeather();
loadBaseTasks().then(() => {
  loadTasks();
  renderTasks();
});

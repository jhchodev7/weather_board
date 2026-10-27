// app.js – 화면 동작 (목록 그리기, 일정 추가)

let tasks = [];
let loadFailed = false;     // Supabase 에서 일정을 못 읽음 (config.js 미입력 · 연결 실패)
let weatherByRegion = {};   // 03 단원에서 지역별 날씨를 넣음
let db = null;              // Supabase 연결 (config.js 의 주소 · 공개용 키)

function getDb() {
  if (!db) db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return db;
}

// 일정을 Supabase 표 wx_tasks 에서 읽음 (먼저 넣은 순서대로)
async function loadTasks() {
  try {
    const { data, error } = await getDb()
      .from('wx_tasks').select('title, region, kind, owner').order('id');
    if (error) throw error;
    tasks = data;
    loadFailed = false;
  } catch (err) {
    tasks = [];
    loadFailed = true;
  }
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
  if (loadFailed) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 6;
    td.className = 'stop';
    td.textContent = '일정 DB를 읽지 못했습니다. (config.js 확인)';
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

// 추가한 일정을 wx_tasks 에 저장하고 목록을 다시 읽음
async function addTask(e) {
  e.preventDefault();
  const form = e.target;
  const msg = document.getElementById('msgBox');
  const t = {
    title: document.getElementById('titleInput').value.trim(),
    region: document.getElementById('regionInput').value,
    kind: document.getElementById('kindInput').value,
    owner: document.getElementById('ownerInput').value.trim(),
  };
  if (!t.title || !t.owner) return;
  msg.textContent = '';
  try {
    const { error } = await getDb().from('wx_tasks').insert(t);
    if (error) throw error;
  } catch (err) {
    msg.textContent = '일정을 저장하지 못했습니다. (config.js · 입력값 확인)';
    return;
  }
  form.reset();
  await loadTasks();
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
loadTasks().then(renderTasks);

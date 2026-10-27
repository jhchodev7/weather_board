// logic.js – 판단 규칙만 (화면을 다루는 코드 금지)

// 교육용 가상 기준 (실제 작업 중지 · 행사 취소 기준은 각 기관 규정을 따름)
const RULES = { wind: 10, rain: 60, heat: 33 };

// 일정 구분과 날씨로 판단 (w가 없으면 '날씨 확인 전')
function judge(kind, w) {
  if (!w) return { level: 'none', text: '날씨 확인 전' };
  if (kind === '실내') return { level: 'ok', text: '영향 없음' };
  if (kind === '고소' && w.windMax >= RULES.wind) return { level: 'stop', text: '중지 검토 (강풍)' };
  if (w.tempMax >= RULES.heat) return { level: 'warn', text: '폭염 휴식' };
  if (w.rainProb >= RULES.rain) return { level: 'warn', text: '우천 주의' };
  return { level: 'ok', text: '진행' };
}

// 지역별 대략 좌표 (Open-Meteo 호출용)
const REGIONS = [
  { name: '세종', lat: 36.48, lon: 127.29 },
  { name: '대전', lat: 36.35, lon: 127.38 },
  { name: '태안', lat: 36.75, lon: 126.30 },
  { name: '보령', lat: 36.33, lon: 126.61 },
];

// 4개 지역 오늘 날씨를 한 번에 받는 주소 (키 없음, 풍속 m/s)
function buildWeatherUrl(regions) {
  return 'https://api.open-meteo.com/v1/forecast'
    + '?latitude=' + regions.map(r => r.lat).join(',')
    + '&longitude=' + regions.map(r => r.lon).join(',')
    + '&daily=temperature_2m_max,wind_speed_10m_max,precipitation_probability_max'
    + '&wind_speed_unit=ms&timezone=Asia/Seoul&forecast_days=1';
}

// 응답 → { 지역이름: { tempMax, windMax, rainProb } } (여러 지역이면 배열로 옴)
function parseWeather(json, regions) {
  const list = Array.isArray(json) ? json : [json];
  const result = {};
  regions.forEach((r, i) => {
    const d = list[i] && list[i].daily;
    if (!d) return;
    result[r.name] = {
      tempMax: d.temperature_2m_max[0],
      windMax: d.wind_speed_10m_max[0],
      rainProb: d.precipitation_probability_max[0],
    };
  });
  return result;
}

// ?test=wind 이면 모든 지역 풍속을 12로 (규칙 시험용)
function applyTestMode(weather, mode) {
  if (mode !== 'wind') return weather;
  const result = {};
  for (const name in weather) result[name] = { ...weather[name], windMax: 12 };
  return result;
}

// 오늘 판단을 마크다운으로 (rows: [일정, 지역, 구분, 담당, 날씨, 판단] 글자 배열들)
function buildJudgeMarkdown(dateText, rows) {
  const cell = v => String(v).replace(/\r?\n/g, ' ').replace(/\|/g, '\\|');
  const lines = [
    '# 현장 일정 판단 (' + dateText + ')',
    '',
    '| 일정 | 지역 | 구분 | 담당 | 날씨 | 판단 |',
    '|---|---|---|---|---|---|',
  ];
  for (const r of rows) lines.push('| ' + r.map(cell).join(' | ') + ' |');
  lines.push('');
  lines.push('판단 기준: ' + ruleText());
  return lines.join('\n') + '\n';
}

// 판단 기준 한 줄 (md 파일 · /api/kma 응답에 같이 씀)
function ruleText() {
  return "고소 일정 최대 풍속 " + RULES.wind + " m/s 이상 '중지 검토' · 강수확률 "
    + RULES.rain + "% 이상 '우천 주의' · 최고 기온 " + RULES.heat + "℃ 이상 '폭염 휴식' (교육용 가상 기준)";
}

// ---- 기상청 단기예보 (공공데이터포털, /api/kma 서버 함수에서 사용) ----

// 위도 · 경도 → 기상청 격자 nx, ny (기상청 공개 변환식, 람베르트 정각원추도법)
function toKmaGrid(lat, lon) {
  const RE = 6371.00877, GRID = 5.0, SLAT1 = 30.0, SLAT2 = 60.0, OLON = 126.0, OLAT = 38.0, XO = 43, YO = 136;
  const DEG = Math.PI / 180;
  const re = RE / GRID;
  const s1 = SLAT1 * DEG, s2 = SLAT2 * DEG, olon = OLON * DEG, olat = OLAT * DEG;
  const q = x => Math.tan(Math.PI * 0.25 + x * 0.5);
  const sn = Math.log(Math.cos(s1) / Math.cos(s2)) / Math.log(q(s2) / q(s1));
  const sf = Math.pow(q(s1), sn) * Math.cos(s1) / sn;
  const ro = re * sf / Math.pow(q(olat), sn);
  const ra = re * sf / Math.pow(q(lat * DEG), sn);
  let theta = lon * DEG - olon;
  if (theta > Math.PI) theta -= 2 * Math.PI;
  if (theta < -Math.PI) theta += 2 * Math.PI;
  theta *= sn;
  return { nx: Math.floor(ra * Math.sin(theta) + XO + 0.5), ny: Math.floor(ro - ra * Math.cos(theta) + YO + 0.5) };
}

// 오늘 하루를 다 담는 발표 시각 (한국 시간) : 02:15 이후면 오늘 02시, 그 전이면 어제 23시
function kmaBaseTime(now) {
  const ymd = d => d.getUTCFullYear() + String(d.getUTCMonth() + 1).padStart(2, '0') + String(d.getUTCDate()).padStart(2, '0');
  const kst = new Date(now.getTime() + 9 * 3600 * 1000);
  const today = ymd(kst);
  if (kst.getUTCHours() * 60 + kst.getUTCMinutes() >= 2 * 60 + 15) return { today, baseDate: today, baseTime: '0200' };
  return { today, baseDate: ymd(new Date(kst.getTime() - 24 * 3600 * 1000)), baseTime: '2300' };
}

// 단기예보 주소 (키가 이미 인코딩된 'Encoding' 키면 그대로, 아니면 인코딩)
function buildKmaUrl(key, base, grid) {
  const k = String(key || '');
  return 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst'
    + '?serviceKey=' + (k.includes('%') ? k : encodeURIComponent(k))
    + '&pageNo=1&numOfRows=1000&dataType=JSON'
    + '&base_date=' + base.baseDate + '&base_time=' + base.baseTime
    + '&nx=' + grid.nx + '&ny=' + grid.ny;
}

// 응답 → 오늘 { tempMax, windMax, rainProb } (TMX 최고 기온 · WSD 풍속 최댓값 · POP 강수확률 최댓값)
function parseKmaForecast(json, today) {
  const items = json && json.response && json.response.body && json.response.body.items && json.response.body.items.item;
  if (!Array.isArray(items)) return null;
  const todays = items.filter(it => it.fcstDate === today);
  const values = cat => todays.filter(it => it.category === cat).map(it => parseFloat(it.fcstValue)).filter(v => !isNaN(v));
  const max = arr => (arr.length ? Math.max(...arr) : null);
  const tempMax = max(values('TMX')) ?? max(values('TMP'));
  const windMax = max(values('WSD'));
  const rainProb = max(values('POP'));
  if (tempMax === null || windMax === null || rainProb === null) return null;
  return { tempMax, windMax, rainProb };
}

if (typeof module !== 'undefined') module.exports = {
  RULES, judge, REGIONS, buildWeatherUrl, parseWeather, applyTestMode, buildJudgeMarkdown, ruleText,
  toKmaGrid, kmaBaseTime, buildKmaUrl, parseKmaForecast,
};

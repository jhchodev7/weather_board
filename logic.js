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

if (typeof module !== 'undefined') module.exports = { RULES, judge, REGIONS, buildWeatherUrl, parseWeather, applyTestMode };

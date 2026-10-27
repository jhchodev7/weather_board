// api/kma.js – Vercel 서버 함수 : /api/kma?region=대전 → 그 지역 일정 · 날씨 · 판단 (JSON)
// Vercel 환경변수 : KMA_KEY (기상청 단기예보, 공공데이터포털) · SUPABASE_URL · SUPABASE_ANON_KEY (공개용 키만)
// KMA_KEY 값은 응답 · 로그에 절대 넣지 않는다.
const {
  judge, REGIONS, applyTestMode, ruleText,
  toKmaGrid, kmaBaseTime, buildKmaUrl, parseKmaForecast,
} = require('../logic.js');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const region = REGIONS.find(r => r.name === req.query.region);
  if (!region) {
    return res.status(400).json({
      error: '지역은 ' + REGIONS.map(r => r.name).join(' · ') + ' 중 하나로 보내 주세요. 예: /api/kma?region=대전',
    });
  }

  // 1) 그 지역 일정 (Supabase wx_tasks) – 실패 원인은 알려 주되 키 값은 넣지 않음
  const dbError = detail => {
    console.error('[api/kma] 일정 DB 읽기 실패', detail);
    return res.status(502).json({ error: '일정 DB를 읽지 못했습니다.', ...detail });
  };
  const supaUrl = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const supaKey = (process.env.SUPABASE_ANON_KEY || '').trim();
  const missing = [!supaUrl && 'SUPABASE_URL', !supaKey && 'SUPABASE_ANON_KEY'].filter(Boolean);
  if (missing.length) return dbError({ missing, hint: 'Vercel 환경변수를 추가한 뒤 Redeploy 하세요.' });

  let tasks;
  try {
    const url = supaUrl + '/rest/v1/wx_tasks'
      + '?select=title,kind,owner&order=id&region=eq.' + encodeURIComponent(region.name);
    const r = await fetch(url, { headers: { apikey: supaKey } });
    if (!r.ok) return dbError({ status: r.status, hint: r.status === 401 ? 'SUPABASE_ANON_KEY 값을 확인하세요.' : 'Supabase 응답 오류' });
    tasks = await r.json();
  } catch (err) {
    return dbError({ reason: String(err && err.message), hint: 'SUPABASE_URL 형식(https://xxxx.supabase.co)을 확인하세요.' });
  }

  // 2) 오늘 날씨 (기상청 단기예보) – 실패해도 일정은 돌려줌
  const base = kmaBaseTime(new Date());
  let weather = null;
  try {
    const r = await fetch(buildKmaUrl(process.env.KMA_KEY, base, toKmaGrid(region.lat, region.lon)));
    if (!r.ok) throw new Error('HTTP ' + r.status);
    weather = parseKmaForecast(await r.json(), base.today);
  } catch (err) {
    weather = null;
  }
  if (weather) weather = applyTestMode({ [region.name]: weather }, req.query.test)[region.name];

  // 3) 일정마다 판단 (R-01 ~ R-05)
  res.status(200).json({
    region: region.name,
    date: base.today.slice(0, 4) + '-' + base.today.slice(4, 6) + '-' + base.today.slice(6, 8),
    weather,
    weatherNote: weather ? '기상청 단기예보 (오늘 최댓값)' : '기상청 날씨를 받지 못했습니다. 판단은 날씨 확인 전으로 표시합니다.',
    tasks: tasks.map(t => {
      const j = judge(t.kind, weather);
      return { title: t.title, kind: t.kind, owner: t.owner, judge: j.text, level: j.level };
    }),
    rule: ruleText(),
  });
};

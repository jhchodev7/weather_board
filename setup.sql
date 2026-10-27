-- setup.sql – Supabase SQL Editor 에서 한 번 실행 (F-06)
-- 일정 표 wx_tasks 만들기 + 값 규칙 + 공개용 키 권한 + 가상 일정 6건

create table if not exists wx_tasks (
  id bigint generated always as identity primary key,
  title  text not null check (char_length(title) between 1 and 100),
  region text not null check (region in ('세종', '대전', '태안', '보령')),
  kind   text not null check (kind in ('야외', '고소', '실내')),
  owner  text not null check (char_length(owner) between 1 and 30),
  created_at timestamptz not null default now()
);

-- 행 단위 보안 켜기 : 아래 정책에 있는 것만 허용
alter table wx_tasks enable row level security;

-- 공개용 키(anon)는 읽기 · 추가만 (수정 · 삭제 정책은 만들지 않음)
create policy "wx_tasks 읽기" on wx_tasks for select to anon using (true);
create policy "wx_tasks 추가" on wx_tasks for insert to anon with check (true);

-- 처음 보이는 가상 일정 6건 (PRD 4장)
insert into wx_tasks (title, region, kind, owner) values
  ('다중이용시설 안전점검', '세종', '야외', '김안전'),
  ('시민 안전체험 행사 운영', '보령', '야외', '이행사'),
  ('옥상 태양광 설비 점검', '태안', '고소', '박설비'),
  ('하천 수위계 확인', '대전', '야외', '최현장'),
  ('청사 외벽 간판 보수', '세종', '고소', '정시설'),
  ('비상연락 훈련', '대전', '실내', '한상황');

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://ruoirqgpnkczkuawxswa.supabase.co'
const SUPABASE_KEY = 'sb_publishable_VH2iLnGzaZIaxwx1RWOWfg_jId-B0iL'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ============================================================
// SQL 建表语句（在 Supabase SQL Editor 中执行一次）
// ============================================================
export const SETUP_SQL = `
-- 班级表
create table if not exists classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  grade text,
  student_count int default 0,
  created_at timestamptz default now()
);

-- 学生表
create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  student_no text not null,
  full_name text not null,
  seat_no text,
  is_active boolean default true,
  created_at timestamptz default now(),
  unique(class_id, student_no)
);

-- 任务表
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  title text not null,
  description text,
  base_score_options jsonb default '[100,90,80,70,60]',
  coefficient_config jsonb default '[
    {"max_percentile":20,"coef":1.00,"label":"优秀梯队"},
    {"max_percentile":50,"coef":0.95,"label":"良好梯队"},
    {"max_percentile":80,"coef":0.90,"label":"普通梯队"},
    {"max_percentile":100,"coef":0.85,"label":"待提高梯队"}
  ]',
  is_finished boolean default false,
  created_at timestamptz default now()
);

-- 成绩表
create table if not exists scores (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  class_id uuid references classes(id) on delete cascade,
  base_score numeric(5,1),
  rank_no int,
  coefficient numeric(4,3),
  final_score numeric(5,1),
  is_manual_coef boolean default false,
  is_leave boolean default false,
  is_absent boolean default false,
  remark text,
  scored_at timestamptz default now(),
  unique(task_id, student_id)
);

-- 管理员配置表（存储哈希密码等）
create table if not exists admin_config (
  key text primary key,
  value text not null,
  updated_at timestamptz default now()
);
alter table admin_config enable row level security;
create policy if not exists "allow_all_admin_config" on admin_config for all using (true) with check (true);

-- 开放 RLS（单教师场景，直接允许所有操作）
alter table classes  enable row level security;
alter table students enable row level security;
alter table tasks    enable row level security;
alter table scores   enable row level security;

create policy if not exists "allow_all_classes"  on classes  for all using (true) with check (true);
create policy if not exists "allow_all_students" on students for all using (true) with check (true);
create policy if not exists "allow_all_tasks"    on tasks    for all using (true) with check (true);
create policy if not exists "allow_all_scores"   on scores   for all using (true) with check (true);
`

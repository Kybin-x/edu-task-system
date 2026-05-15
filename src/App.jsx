
import { useState, useEffect, useCallback, useRef } from "react";

// ============================================================
// 持久化存储工具
// ============================================================


function dbGet(key) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : null;
  } catch { return null; }
}

function dbSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch(e) { console.error('storage error', e); }
}

function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function now() { return new Date().toISOString(); }

// ============================================================
// 系数计算
// ============================================================
const DEFAULT_TIERS = [
  { max_percentile: 20, coef: 1.00, label: "优秀梯队" },
  { max_percentile: 50, coef: 0.95, label: "良好梯队" },
  { max_percentile: 80, coef: 0.90, label: "普通梯队" },
  { max_percentile: 100, coef: 0.85, label: "待提高梯队" },
];

function calcCoefficient(rankNo, classTotal, tiers = DEFAULT_TIERS) {
  if (!rankNo || !classTotal) return { coef: 1.0, label: "—", percentile: 0 };
  const percentile = (rankNo / classTotal) * 100;
  for (const tier of tiers) {
    if (percentile <= tier.max_percentile) return { coef: tier.coef, label: tier.label, percentile };
  }
  const last = tiers[tiers.length - 1];
  return { coef: last.coef, label: last.label, percentile };
}

function calcFinalScore(base, coef) {
  return Math.min(100, Math.round(base * coef * 10) / 10);
}

// ============================================================
// 主题色
// ============================================================
const THEME = {
  primary: "#1a56db",
  primaryLight: "#ebf0ff",
  success: "#057a55",
  successLight: "#e3fcef",
  warning: "#c27803",
  warningLight: "#fdf6b2",
  danger: "#e02424",
  dangerLight: "#fde8e8",
  gray: "#6b7280",
  grayLight: "#f3f4f6",
  border: "#e5e7eb",
  bg: "#f9fafb",
};

// ============================================================
// 初始演示数据
// ============================================================
const DEMO_DATA = {
  classes: [
    { id: "c1", name: "电商2301班", grade: "2023级", student_count: 0 },
    { id: "c2", name: "电商2302班", grade: "2023级", student_count: 0 },
  ],
  students: [
    { id: "s1", class_id: "c1", student_no: "2301001", full_name: "张小明", seat_no: "A1" },
    { id: "s2", class_id: "c1", student_no: "2301002", full_name: "李小红", seat_no: "A2" },
    { id: "s3", class_id: "c1", student_no: "2301003", full_name: "王小华", seat_no: "A3" },
    { id: "s4", class_id: "c1", student_no: "2301004", full_name: "赵小芳", seat_no: "A4" },
    { id: "s5", class_id: "c1", student_no: "2301005", full_name: "陈小刚", seat_no: "B1" },
    { id: "s6", class_id: "c1", student_no: "2301006", full_name: "刘小燕", seat_no: "B2" },
    { id: "s7", class_id: "c1", student_no: "2301007", full_name: "孙小伟", seat_no: "B3" },
    { id: "s8", class_id: "c1", student_no: "2301008", full_name: "周小丽", seat_no: "B4" },
    { id: "s9", class_id: "c1", student_no: "2301009", full_name: "吴小强", seat_no: "C1" },
    { id: "s10", class_id: "c1", student_no: "2301010", full_name: "郑小梅", seat_no: "C2" },
    { id: "s11", class_id: "c2", student_no: "2302001", full_name: "冯小军", seat_no: "A1" },
    { id: "s12", class_id: "c2", student_no: "2302002", full_name: "蒋小云", seat_no: "A2" },
    { id: "s13", class_id: "c2", student_no: "2302003", full_name: "沈小峰", seat_no: "A3" },
    { id: "s14", class_id: "c2", student_no: "2302004", full_name: "韩小玲", seat_no: "A4" },
    { id: "s15", class_id: "c2", student_no: "2302005", full_name: "杨小洋", seat_no: "B1" },
    { id: "s16", class_id: "c2", student_no: "2302006", full_name: "朱小静", seat_no: "B2" },
    { id: "s17", class_id: "c2", student_no: "2302007", full_name: "秦小博", seat_no: "B3" },
    { id: "s18", class_id: "c2", student_no: "2302008", full_name: "许小萍", seat_no: "B4" },
  ],
  tasks: [
    {
      id: "t1", class_id: "c1", title: "店铺首页Banner设计", description: "使用PS制作1920×600像素店铺Banner，包含主图、促销文字和品牌logo，导出为JPG格式",
      base_score_options: [100, 90, 80, 70, 60], coefficient_config: DEFAULT_TIERS,
      is_finished: false, created_at: new Date(Date.now() - 86400000).toISOString()
    },
    {
      id: "t2", class_id: "c1", title: "商品详情页文案撰写", description: "为指定商品撰写详情页文案，包含卖点提炼、规格说明和使用场景，不少于500字",
      base_score_options: [100, 90, 80, 70, 60], coefficient_config: DEFAULT_TIERS,
      is_finished: true, created_at: new Date(Date.now() - 172800000).toISOString()
    },
  ],
  scores: [],
};

// ============================================================
// CSS
// ============================================================


// ============================================================
// Toast
// ============================================================
function ToastContainer({ toasts }) {
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>
      ))}
    </div>
  );
}

function useToast() {
  const [toasts, setToasts] = useState([]);
  const show = useCallback((msg, type = "success") => {
    const id = uuid();
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000);
  }, []);
  return { toasts, show };
}

// ============================================================
// Modal
// ============================================================
function Modal({ title, onClose, children, footer }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

// ============================================================
// 数据 Hook
// ============================================================
function useData() {
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [scores, setScores] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const c = dbGet("etm_classes") || DEMO_DATA.classes;
    const s = dbGet("etm_students") || DEMO_DATA.students;
    const t = dbGet("etm_tasks") || DEMO_DATA.tasks;
    const sc = dbGet("etm_scores") || DEMO_DATA.scores;
    const fixed = c.map(cl => ({
      ...cl,
      student_count: s.filter(st => st.class_id === cl.id && st.is_active !== false).length
    }));
    setClasses(fixed);
    setStudents(s);
    setTasks(t);
    setScores(sc);
    setLoaded(true);
  }, []);

  const saveClasses = (v) => { setClasses(v); dbSet("etm_classes", v); };
  const saveStudents = (v) => { setStudents(v); dbSet("etm_students", v); };
  const saveTasks = (v) => { setTasks(v); dbSet("etm_tasks", v); };
  const saveScores = (v) => { setScores(v); dbSet("etm_scores", v); };

  return { classes, students, tasks, scores, loaded, saveClasses, saveStudents, saveTasks, saveScores };
}

// ============================================================
// 仪表盘
// ============================================================
function Dashboard({ data }) {
  const { classes, students, tasks, scores } = data;
  const activeTasks = tasks.filter(t => !t.is_finished);
  const finishedTasks = tasks.filter(t => t.is_finished);
  const totalScores = scores.length;

  // 最近任务
  const recentTasks = [...tasks].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5);

  return (
    <div>
      <div className="grid-4" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-label">📚 班级总数</div>
          <div className="stat-value">{classes.length}</div>
          <div className="stat-sub">共 {students.filter(s => s.is_active !== false).length} 名学生</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">📋 进行中任务</div>
          <div className="stat-value" style={{ color: "#1a56db" }}>{activeTasks.length}</div>
          <div className="stat-sub">待完成登记</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">✅ 已完成任务</div>
          <div className="stat-value" style={{ color: "#057a55" }}>{finishedTasks.length}</div>
          <div className="stat-sub">已结束登记</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">📝 成绩记录数</div>
          <div className="stat-value" style={{ color: "#c27803" }}>{totalScores}</div>
          <div className="stat-sub">累计登记</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <span className="card-title">最近任务</span>
          </div>
          <div>
            {recentTasks.length === 0 ? (
              <div className="empty"><div className="empty-icon">📋</div><p>暂无任务</p></div>
            ) : recentTasks.map(t => {
              const cls = classes.find(c => c.id === t.class_id);
              const taskScores = scores.filter(s => s.task_id === t.id);
              const total = cls?.student_count || 0;
              const pct = total > 0 ? Math.round(taskScores.length / total * 100) : 0;
              return (
                <div key={t.id} style={{ padding: "12px 20px", borderBottom: "1px solid #f3f4f6" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{t.title}</div>
                      <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{cls?.name} · {new Date(t.created_at).toLocaleDateString("zh-CN")}</div>
                    </div>
                    <span className={`badge ${t.is_finished ? "badge-green" : "badge-blue"}`}>
                      {t.is_finished ? "已结束" : "进行中"}
                    </span>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#6b7280", marginBottom: 4 }}>
                      <span>登记进度</span><span>{taskScores.length}/{total} ({pct}%)</span>
                    </div>
                    <div className="progress-bar"><div className="progress-fill" style={{ width: pct + "%" }} /></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">班级概览</span></div>
          <div>
            {classes.map(cls => {
              const clsStudents = students.filter(s => s.class_id === cls.id && s.is_active !== false);
              const clsTasks = tasks.filter(t => t.class_id === cls.id);
              const clsScores = scores.filter(s => {
                const task = tasks.find(t => t.id === s.task_id);
                return task?.class_id === cls.id;
              });
              return (
                <div key={cls.id} style={{ padding: "14px 20px", borderBottom: "1px solid #f3f4f6" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{cls.name}</div>
                      <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{cls.grade}</div>
                    </div>
                    <div style={{ textAlign: "right", fontSize: 12, color: "#6b7280" }}>
                      <div>👨‍🎓 {clsStudents.length} 人</div>
                      <div>📋 {clsTasks.length} 个任务</div>
                    </div>
                  </div>
                </div>
              );
            })}
            {classes.length === 0 && <div className="empty"><div className="empty-icon">🏫</div><p>暂无班级</p></div>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 任务管理
// ============================================================
function TaskManager({ data, toast }) {
  const { classes, tasks, scores, saveTasks, saveScores } = data;
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ class_id: "", title: "", description: "", base_score_options: "100,90,80,70,60" });
  const [activeTab, setActiveTab] = useState("active");
  const [confirmFinish, setConfirmFinish] = useState(null);

  const activeTasks = tasks.filter(t => !t.is_finished);
  const finishedTasks = tasks.filter(t => t.is_finished);
  const displayTasks = activeTab === "active" ? activeTasks : finishedTasks;

  const handleAdd = () => {
    if (!form.class_id || !form.title.trim()) { toast.show("请填写班级和任务名称", "error"); return; }
    const opts = form.base_score_options.split(",").map(v => parseInt(v.trim())).filter(v => !isNaN(v) && v > 0);
    if (opts.length === 0) { toast.show("请设置有效的基础分选项", "error"); return; }
    const newTask = {
      id: uuid(), class_id: form.class_id, title: form.title.trim(),
      description: form.description.trim(), base_score_options: opts,
      coefficient_config: DEFAULT_TIERS, is_finished: false, created_at: now()
    };
    saveTasks([...tasks, newTask]);
    setShowAdd(false);
    setForm({ class_id: "", title: "", description: "", base_score_options: "100,90,80,70,60" });
    toast.show("任务发布成功 🎉");
  };

  const handleFinish = async (task) => {
    // batch unscored → 0
    const cls = classes.find(c => c.id === task.class_id);
    const allStudents = data.students.filter(s => s.class_id === task.class_id && s.is_active !== false);
    const scoredIds = scores.filter(s => s.task_id === task.id).map(s => s.student_id);
    const unscored = allStudents.filter(s => !scoredIds.includes(s.id));
    const classTotal = cls?.student_count || allStudents.length;

    const newScores = unscored.map(s => {
      const rankNo = scoredIds.length + 1;
      return {
        id: uuid(), task_id: task.id, student_id: s.id,
        base_score: 0, rank_no: null, coefficient: 0, final_score: 0,
        is_manual_coef: false, is_leave: false, is_absent: true,
        remark: "未提交", scored_at: now()
      };
    });

    const updatedTasks = tasks.map(t => t.id === task.id ? { ...t, is_finished: true } : t);
    saveTasks(updatedTasks);
    if (newScores.length > 0) saveScores([...scores, ...newScores]);
    setConfirmFinish(null);
    toast.show(`任务已结束，${unscored.length} 名未提交学生记 0 分`);
  };

  const handleDelete = async (taskId) => {
    saveTasks(tasks.filter(t => t.id !== taskId));
    saveScores(scores.filter(s => s.task_id !== taskId));
    toast.show("任务已删除");
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div className="tabs" style={{ margin: 0 }}>
          <div className={`tab ${activeTab === "active" ? "active" : ""}`} onClick={() => setActiveTab("active")}>进行中 ({activeTasks.length})</div>
          <div className={`tab ${activeTab === "finished" ? "active" : ""}`} onClick={() => setActiveTab("finished")}>已完成 ({finishedTasks.length})</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>＋ 发布新任务</button>
      </div>

      {displayTasks.length === 0 ? (
        <div className="card"><div className="empty"><div className="empty-icon">📋</div><p>{activeTab === "active" ? "暂无进行中任务，点击发布新任务" : "暂无已完成任务"}</p></div></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {displayTasks.map(task => {
            const cls = classes.find(c => c.id === task.class_id);
            const taskScores = scores.filter(s => s.task_id === task.id && !s.is_absent);
            const total = cls?.student_count || 0;
            const pct = total > 0 ? Math.round(taskScores.length / total * 100) : 0;
            return (
              <div className="card" key={task.id}>
                <div className="card-body">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                        <span style={{ fontWeight: 700, fontSize: 15 }}>{task.title}</span>
                        <span className={`badge ${task.is_finished ? "badge-green" : "badge-blue"}`}>{task.is_finished ? "✓ 已结束" : "● 进行中"}</span>
                        <span className="badge badge-gray">{cls?.name}</span>
                      </div>
                      {task.description && <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 10 }}>{task.description}</p>}
                      <div style={{ display: "flex", gap: 20, fontSize: 12, color: "#9ca3af" }}>
                        <span>📅 {new Date(task.created_at).toLocaleDateString("zh-CN")}</span>
                        <span>👥 {taskScores.length}/{total} 已登记</span>
                        <span>💯 基础分: {task.base_score_options?.join(" / ")}</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginLeft: 16 }}>
                      {!task.is_finished && (
                        <button className="btn btn-outline btn-sm" onClick={() => setConfirmFinish(task)}>结束登记</button>
                      )}
                      <button className="btn btn-ghost btn-sm" style={{ color: "#e02424" }} onClick={() => handleDelete(task.id)}>删除</button>
                    </div>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#6b7280", marginBottom: 4 }}>
                      <span>登记进度</span><span>{pct}%</span>
                    </div>
                    <div className="progress-bar"><div className="progress-fill" style={{ width: pct + "%" }} /></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAdd && (
        <Modal title="发布新任务" onClose={() => setShowAdd(false)}
          footer={<><button className="btn btn-outline" onClick={() => setShowAdd(false)}>取消</button><button className="btn btn-primary" onClick={handleAdd}>确认发布</button></>}>
          <div className="form-group">
            <label className="form-label">班级 *</label>
            <select className="form-select" value={form.class_id} onChange={e => setForm({ ...form, class_id: e.target.value })}>
              <option value="">请选择班级</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">任务名称 *</label>
            <input className="form-input" placeholder="例：店铺首页Banner设计" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">任务说明</label>
            <textarea className="form-textarea" placeholder="任务具体要求、格式规范等..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">基础分选项</label>
            <input className="form-input" placeholder="100,90,80,70,60" value={form.base_score_options} onChange={e => setForm({ ...form, base_score_options: e.target.value })} />
            <p className="form-hint">用英文逗号分隔，打分时点选</p>
          </div>
        </Modal>
      )}

      {confirmFinish && (
        <Modal title="确认结束登记" onClose={() => setConfirmFinish(null)}
          footer={<><button className="btn btn-outline" onClick={() => setConfirmFinish(null)}>取消</button><button className="btn btn-danger" onClick={() => handleFinish(confirmFinish)}>确认结束，未登记记0分</button></>}>
          <div className="alert alert-warning">
            <strong>⚠️ 此操作不可撤销</strong>
          </div>
          <p style={{ fontSize: 13, color: "#374151" }}>
            即将结束任务「{confirmFinish.title}」的登记。<br /><br />
            未登记的学生将自动记 <strong>0 分</strong>。
          </p>
        </Modal>
      )}
    </div>
  );
}

// ============================================================
// ⭐ 打分页面（核心）
// ============================================================
function ScoringPage({ data, toast }) {
  const { classes, tasks, scores, students, saveScores } = data;
  const [selTask, setSelTask] = useState(null);
  const [scoringStudent, setScoringStudent] = useState(null);
  const [baseScore, setBaseScore] = useState(null);
  const [isLeave, setIsLeave] = useState(false);
  const [remark, setRemark] = useState("");
  const [manualCoef, setManualCoef] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [viewMode, setViewMode] = useState("grid"); // grid | list

  const activeTasks = tasks.filter(t => !t.is_finished);

  const taskStudents = selTask
    ? students.filter(s => s.class_id === selTask.class_id && s.is_active !== false)
    : [];

  const taskScores = selTask ? scores.filter(s => s.task_id === selTask.id) : [];
  const scoredStudentIds = taskScores.filter(s => !s.is_absent).map(s => s.student_id);
  const leaveIds = taskScores.filter(s => s.is_leave).map(s => s.student_id);

  const cls = selTask ? classes.find(c => c.id === selTask.class_id) : null;
  const classTotal = cls?.student_count || taskStudents.length;

  const filteredStudents = taskStudents.filter(s =>
    !searchQ || s.full_name.includes(searchQ) || s.student_no.includes(searchQ) || (s.seat_no || "").includes(searchQ)
  );

  const currentRank = scoredStudentIds.length + 1;
  const previewCoef = (() => {
    const mc = parseFloat(manualCoef);
    if (!isNaN(mc) && mc > 0 && mc <= 1) return { coef: mc, label: "手动设定" };
    if (isLeave) return { coef: 1, label: "请假" };
    return calcCoefficient(currentRank, classTotal, selTask?.coefficient_config || DEFAULT_TIERS);
  })();

  const previewFinal = baseScore != null
    ? (isLeave ? 60 : calcFinalScore(baseScore, previewCoef.coef))
    : null;

  const handleSubmitScore = () => {
    if (!scoringStudent || baseScore == null) { toast.show("请选择基础分", "error"); return; }

    const mc = parseFloat(manualCoef);
    const useManual = !isNaN(mc) && mc > 0 && mc <= 1;

    let finalBase = isLeave ? 60 : baseScore;
    let coef, final;

    if (isLeave) {
      coef = 1.0; final = 60;
    } else {
      coef = useManual ? mc : previewCoef.coef;
      final = calcFinalScore(baseScore, coef);
    }

    const existing = scores.find(s => s.task_id === selTask.id && s.student_id === scoringStudent.id);
    const scoreRecord = {
      id: existing?.id || uuid(),
      task_id: selTask.id, student_id: scoringStudent.id,
      base_score: finalBase, rank_no: isLeave ? null : currentRank,
      coefficient: coef, final_score: final,
      is_manual_coef: useManual || isLeave, is_leave: isLeave, is_absent: false,
      remark: remark.trim(), scored_at: now()
    };

    let newScores;
    if (existing) {
      newScores = scores.map(s => (s.id === existing.id ? scoreRecord : s));
    } else {
      newScores = [...scores, scoreRecord];
    }

    saveScores(newScores);
    toast.show(`✓ ${scoringStudent.full_name} 登记成功，最终分 ${final}`);
    setScoringStudent(null);
    setBaseScore(null);
    setIsLeave(false);
    setRemark("");
    setManualCoef("");
  };

  const handleUndo = async (studentId) => {
    saveScores(scores.filter(s => !(s.task_id === selTask.id && s.student_id === studentId)));
    toast.show("已撤销该学生成绩");
  };

  const tierLabel = (s) => {
    if (!s || s.is_leave) return { cls: "tier-2", label: "请假" };
    if (s.is_absent) return { cls: "tier-3", label: "缺交" };
    const t = selTask?.coefficient_config || DEFAULT_TIERS;
    const pct = classTotal > 0 ? (s.rank_no / classTotal) * 100 : 0;
    if (pct <= t[0].max_percentile) return { cls: "tier-0", label: t[0].label };
    if (pct <= t[1].max_percentile) return { cls: "tier-1", label: t[1].label };
    if (pct <= t[2].max_percentile) return { cls: "tier-2", label: t[2].label };
    return { cls: "tier-3", label: t[3].label };
  };

  return (
    <div>
      {/* 任务选择 */}
      {!selTask ? (
        <div>
          <div className="alert alert-info" style={{ marginBottom: 20 }}>💡 选择一个进行中的任务开始登记成绩</div>
          {activeTasks.length === 0 ? (
            <div className="card"><div className="empty"><div className="empty-icon">✅</div><p>当前没有进行中的任务</p></div></div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {activeTasks.map(t => {
                const cls = classes.find(c => c.id === t.class_id);
                const ts = scores.filter(s => s.task_id === t.id && !s.is_absent);
                const total = cls?.student_count || 0;
                return (
                  <div className="card" key={t.id} style={{ cursor: "pointer" }} onClick={() => setSelTask(t)}>
                    <div className="card-body" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{t.title}</div>
                        <div style={{ fontSize: 12, color: "#6b7280" }}>{cls?.name} · 已登记 {ts.length}/{total}</div>
                      </div>
                      <button className="btn btn-primary">开始打分 →</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div>
          {/* 顶部信息栏 */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelTask(null)}>← 返回</button>
              <span style={{ fontWeight: 700, fontSize: 15, marginLeft: 8 }}>{selTask.title}</span>
              <span className="badge badge-gray" style={{ marginLeft: 8 }}>{cls?.name}</span>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "#6b7280" }}>
                已登记 <strong style={{ color: "#1a56db" }}>{scoredStudentIds.length}</strong>/{classTotal}
              </span>
              <button className={`btn btn-sm ${viewMode === "grid" ? "btn-primary" : "btn-outline"}`} onClick={() => setViewMode("grid")}>宫格</button>
              <button className={`btn btn-sm ${viewMode === "list" ? "btn-primary" : "btn-outline"}`} onClick={() => setViewMode("list")}>列表</button>
            </div>
          </div>

          {/* 搜索 */}
          <div style={{ marginBottom: 16 }}>
            <input className="form-input" placeholder="🔍 搜索姓名、学号、座位号..." value={searchQ} onChange={e => setSearchQ(e.target.value)} style={{ maxWidth: 280 }} />
          </div>

          {/* 统计条 */}
          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            {(selTask.coefficient_config || DEFAULT_TIERS).map((tier, i) => {
              const count = taskScores.filter(s => {
                if (!s.rank_no) return false;
                const pct = (s.rank_no / classTotal) * 100;
                const prev = i > 0 ? (selTask.coefficient_config || DEFAULT_TIERS)[i - 1].max_percentile : 0;
                return pct > prev && pct <= tier.max_percentile;
              }).length;
              return (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", background: "white", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 16px", minWidth: 80 }}>
                  <span style={{ fontSize: 20, fontWeight: 700 }}>{count}</span>
                  <span style={{ fontSize: 11, color: "#6b7280" }}>{tier.label}</span>
                  <span style={{ fontSize: 11, color: "#9ca3af" }}>×{tier.coef.toFixed(2)}</span>
                </div>
              );
            })}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", background: "white", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 16px", minWidth: 80 }}>
              <span style={{ fontSize: 20, fontWeight: 700, color: "#e02424" }}>{taskStudents.length - scoredStudentIds.length - leaveIds.length}</span>
              <span style={{ fontSize: 11, color: "#6b7280" }}>未登记</span>
            </div>
          </div>

          {/* 学生视图 */}
          {viewMode === "grid" ? (
            <div className="student-grid">
              {filteredStudents.map(s => {
                const sc = taskScores.find(sc => sc.student_id === s.id);
                const scored = sc && !sc.is_absent;
                const leave = sc?.is_leave;
                return (
                  <div
                    key={s.id}
                    className={`student-card ${scored ? (leave ? "leave" : "scored") : ""}`}
                    onClick={() => { setScoringStudent(s); setBaseScore(null); setIsLeave(leave || false); setRemark(sc?.remark || ""); setManualCoef(sc?.is_manual_coef && !leave ? sc.coefficient.toString() : ""); }}
                  >
                    <div className="check">
                      {scored ? (leave ? "🟡" : "✅") : ""}
                    </div>
                    <div className="sname">{s.full_name}</div>
                    <div className="sno">{s.student_no}</div>
                    {s.seat_no && <div className="sseat">📍{s.seat_no}</div>}
                    {scored && !sc.is_absent && (
                      <>
                        <div className="sscore">{sc.final_score}</div>
                        <div className="srank">第 {sc.rank_no || "—"} 位登记</div>
                      </>
                    )}
                    {sc?.is_absent && <div style={{ fontSize: 12, color: "#e02424", marginTop: 6 }}>缺交 0分</div>}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="card">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>学号</th><th>姓名</th><th>座位</th><th>状态</th>
                      <th>登记顺序</th><th>基础分</th><th>系数</th><th>最终分</th><th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map(s => {
                      const sc = taskScores.find(sc => sc.student_id === s.id);
                      const t = sc ? tierLabel(sc) : null;
                      return (
                        <tr key={s.id}>
                          <td>{s.student_no}</td>
                          <td style={{ fontWeight: 500 }}>{s.full_name}</td>
                          <td>{s.seat_no || "—"}</td>
                          <td>
                            {sc ? (
                              sc.is_absent ? <span className="badge badge-red">缺交</span>
                                : sc.is_leave ? <span className="badge badge-yellow">请假</span>
                                : <span className={`coef-tier ${t.cls}`}>{t.label}</span>
                            ) : <span className="badge badge-gray">未登记</span>}
                          </td>
                          <td>{sc?.rank_no || "—"}</td>
                          <td>{sc && !sc.is_absent ? sc.base_score : "—"}</td>
                          <td>{sc && !sc.is_absent ? "×" + sc.coefficient.toFixed(2) : "—"}</td>
                          <td style={{ fontWeight: 700, color: sc && !sc.is_absent ? "#057a55" : "#9ca3af" }}>
                            {sc ? sc.final_score : "—"}
                          </td>
                          <td>
                            <button className="btn btn-outline btn-sm" onClick={() => { setScoringStudent(s); setBaseScore(null); setIsLeave(sc?.is_leave || false); setRemark(sc?.remark || ""); setManualCoef(sc?.is_manual_coef && !sc?.is_leave ? sc.coefficient.toString() : ""); }}>
                              {sc && !sc.is_absent ? "修改" : "打分"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 打分弹窗 */}
      {scoringStudent && (
        <Modal
          title={`登记成绩 — ${scoringStudent.full_name}`}
          onClose={() => { setScoringStudent(null); setBaseScore(null); setIsLeave(false); setRemark(""); setManualCoef(""); }}
          footer={
            <>
              {scores.find(s => s.task_id === selTask?.id && s.student_id === scoringStudent.id && !s.is_absent) && (
                <button className="btn btn-ghost btn-sm" style={{ color: "#e02424", marginRight: "auto" }}
                  onClick={() => { handleUndo(scoringStudent.id); setScoringStudent(null); }}>撤销成绩</button>
              )}
              <button className="btn btn-outline" onClick={() => { setScoringStudent(null); setBaseScore(null); setIsLeave(false); setRemark(""); setManualCoef(""); }}>取消</button>
              <button className="btn btn-success" onClick={handleSubmitScore} disabled={!isLeave && baseScore == null}>
                ✓ 确认登记
              </button>
            </>
          }
        >
          <div style={{ background: "#f9fafb", borderRadius: 8, padding: "12px 16px", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#6b7280" }}>
              <span>学号：{scoringStudent.student_no}</span>
              {scoringStudent.seat_no && <span>座位：{scoringStudent.seat_no}</span>}
              <span>当前第 {currentRank} 位</span>
            </div>
          </div>

          {/* 请假开关 */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, padding: "10px 14px", background: isLeave ? "#fffbeb" : "#f9fafb", borderRadius: 8, border: `1px solid ${isLeave ? "#f59e0b" : "#e5e7eb"}` }}>
            <input type="checkbox" id="leave" checked={isLeave} onChange={e => { setIsLeave(e.target.checked); if (e.target.checked) { setBaseScore(60); setManualCoef(""); } else setBaseScore(null); }} style={{ width: 16, height: 16, cursor: "pointer" }} />
            <label htmlFor="leave" style={{ fontSize: 13, fontWeight: 500, cursor: "pointer", color: isLeave ? "#92400e" : "#374151" }}>
              🟡 请假（自动记 60 分，不参与排名）
            </label>
          </div>

          {!isLeave && (
            <>
              <div className="form-group">
                <label className="form-label">基础分 *</label>
                <div className="score-options">
                  {(selTask?.base_score_options || [100, 90, 80, 70, 60]).map(opt => (
                    <button key={opt} className={`score-opt ${baseScore === opt ? "selected" : ""}`} onClick={() => setBaseScore(opt)}>
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">手动覆盖系数（选填，0~1之间）</label>
                <input className="form-input" type="number" min="0" max="1" step="0.01" placeholder="默认按顺序自动计算" value={manualCoef} onChange={e => setManualCoef(e.target.value)} />
                <p className="form-hint">留空则自动计算，填写后会记录为手动覆盖</p>
              </div>
            </>
          )}

          {/* 预览 */}
          <div style={{ background: "#f0fdf4", border: "1px solid #a7f3d0", borderRadius: 10, padding: "14px 18px", marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: "#065f46", marginBottom: 8, fontWeight: 600 }}>📊 预览计算结果</div>
            <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>基础分</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{isLeave ? 60 : (baseScore ?? "—")}</div>
              </div>
              {!isLeave && <div style={{ color: "#9ca3af", fontSize: 18 }}>×</div>}
              {!isLeave && (
                <div>
                  <div style={{ fontSize: 11, color: "#6b7280" }}>系数</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "#1a56db" }}>{previewCoef.coef.toFixed(2)}</div>
                  <div style={{ fontSize: 11, color: "#6b7280" }}>{previewCoef.label}</div>
                </div>
              )}
              {!isLeave && <div style={{ color: "#9ca3af", fontSize: 18 }}>=</div>}
              <div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>最终分</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#057a55" }}>{previewFinal ?? (isLeave ? 60 : "—")}</div>
              </div>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">备注（选填）</label>
            <input className="form-input" placeholder="如：未完成关键步骤 / 格式错误" value={remark} onChange={e => setRemark(e.target.value)} />
          </div>
        </Modal>
      )}
    </div>
  );
}

// ============================================================
// 成绩查询
// ============================================================
function ScoreView({ data, toast }) {
  const { classes, tasks, scores, students } = data;
  const [selClass, setSelClass] = useState("");
  const [selTask, setSelTask] = useState("");

  const classTasks = selClass ? tasks.filter(t => t.class_id === selClass) : [];
  const task = tasks.find(t => t.id === selTask);
  const cls = classes.find(c => c.id === selClass);

  const taskStudents = task ? students.filter(s => s.class_id === task.class_id && s.is_active !== false) : [];
  const taskScores = task ? scores.filter(s => s.task_id === task.id) : [];

  const displayRows = taskStudents.map(s => {
    const sc = taskScores.find(sc => sc.student_id === s.id);
    return { student: s, score: sc };
  }).sort((a, b) => {
    if (!a.score && !b.score) return a.student.student_no.localeCompare(b.student.student_no);
    if (!a.score) return 1;
    if (!b.score) return -1;
    return (b.score.final_score || 0) - (a.score.final_score || 0);
  });

  const avg = taskScores.filter(s => !s.is_absent).length > 0
    ? (taskScores.filter(s => !s.is_absent).reduce((a, s) => a + s.final_score, 0) / taskScores.filter(s => !s.is_absent).length).toFixed(1)
    : "—";

  const handleExport = () => {
    if (!task || displayRows.length === 0) { toast.show("无数据可导出", "error"); return; }
    const header = "学号,姓名,座位,状态,登记顺序,基础分,系数,最终分,备注\n";
    const rows = displayRows.map(({ student: s, score: sc }) => {
      if (!sc) return `${s.student_no},${s.full_name},${s.seat_no || ""},未登记,,,,0,`;
      if (sc.is_absent) return `${s.student_no},${s.full_name},${s.seat_no || ""},缺交,,,,0,`;
      if (sc.is_leave) return `${s.student_no},${s.full_name},${s.seat_no || ""},请假,,60,1.00,60,${sc.remark || ""}`;
      return `${s.student_no},${s.full_name},${s.seat_no || ""},已登记,${sc.rank_no},${sc.base_score},${sc.coefficient.toFixed(2)},${sc.final_score},${sc.remark || ""}`;
    }).join("\n");
    const blob = new Blob(["\uFEFF" + header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${cls?.name}_${task.title}_成绩.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast.show("导出成功 📥");
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <select className="form-select" style={{ maxWidth: 180 }} value={selClass} onChange={e => { setSelClass(e.target.value); setSelTask(""); }}>
          <option value="">选择班级</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="form-select" style={{ maxWidth: 240 }} value={selTask} onChange={e => setSelTask(e.target.value)} disabled={!selClass}>
          <option value="">选择任务</option>
          {classTasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
        </select>
        {selTask && (
          <button className="btn btn-outline" onClick={handleExport}>📥 导出 CSV</button>
        )}
      </div>

      {!selTask ? (
        <div className="card"><div className="empty"><div className="empty-icon">📊</div><p>请选择班级和任务查看成绩</p></div></div>
      ) : (
        <>
          {/* 统计卡片 */}
          <div className="grid-4" style={{ marginBottom: 20 }}>
            <div className="stat-card">
              <div className="stat-label">班级人数</div>
              <div className="stat-value">{taskStudents.length}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">已登记</div>
              <div className="stat-value" style={{ color: "#057a55" }}>{taskScores.filter(s => !s.is_absent).length}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">平均分</div>
              <div className="stat-value" style={{ color: "#1a56db" }}>{avg}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">缺交</div>
              <div className="stat-value" style={{ color: "#e02424" }}>{taskScores.filter(s => s.is_absent).length + taskStudents.length - taskScores.length}</div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">{task?.title} — 成绩详情</span>
              <span className={`badge ${task?.is_finished ? "badge-green" : "badge-blue"}`}>{task?.is_finished ? "已结束" : "进行中"}</span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>排名</th><th>学号</th><th>姓名</th><th>座位</th><th>状态</th><th>登记顺序</th><th>基础分</th><th>系数</th><th>最终分</th><th>备注</th></tr>
                </thead>
                <tbody>
                  {displayRows.map(({ student: s, score: sc }, i) => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 700, color: i < 3 ? "#c27803" : "#9ca3af" }}>
                        {sc && !sc.is_absent && !sc.is_leave ? i + 1 : "—"}
                      </td>
                      <td>{s.student_no}</td>
                      <td style={{ fontWeight: 500 }}>{s.full_name}</td>
                      <td>{s.seat_no || "—"}</td>
                      <td>
                        {!sc ? <span className="badge badge-gray">未登记</span>
                          : sc.is_absent ? <span className="badge badge-red">缺交</span>
                          : sc.is_leave ? <span className="badge badge-yellow">请假</span>
                          : <span className="badge badge-green">已登记</span>}
                      </td>
                      <td>{sc?.rank_no || "—"}</td>
                      <td>{sc && !sc.is_absent ? sc.base_score : "—"}</td>
                      <td>{sc && !sc.is_absent ? "×" + sc.coefficient.toFixed(2) : "—"}</td>
                      <td style={{ fontWeight: 700, fontSize: 15, color: sc?.final_score > 0 ? "#057a55" : "#9ca3af" }}>
                        {sc?.final_score != null ? sc.final_score : "—"}
                      </td>
                      <td style={{ color: "#9ca3af", fontSize: 12 }}>{sc?.remark || ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================
// 数据管理
// ============================================================
function DataManager({ data, toast }) {
  const { classes, students, saveClasses, saveStudents } = data;
  const [tab, setTab] = useState("classes");
  const [showAddClass, setShowAddClass] = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [classForm, setClassForm] = useState({ name: "", grade: "" });
  const [studentForm, setStudentForm] = useState({ class_id: "", student_no: "", full_name: "", seat_no: "" });
  const [batchText, setBatchText] = useState("");
  const [showBatch, setShowBatch] = useState(false);
  const [filterClass, setFilterClass] = useState("");

  const handleAddClass = () => {
    if (!classForm.name.trim()) { toast.show("请填写班级名称", "error"); return; }
    const nc = { id: uuid(), name: classForm.name.trim(), grade: classForm.grade.trim(), student_count: 0, created_at: now() };
    saveClasses([...classes, nc]);
    setShowAddClass(false); setClassForm({ name: "", grade: "" });
    toast.show("班级添加成功");
  };

  const handleDeleteClass = async (id) => {
    saveClasses(classes.filter(c => c.id !== id));
    saveStudents(students.filter(s => s.class_id !== id));
    toast.show("班级已删除");
  };

  const handleAddStudent = () => {
    if (!studentForm.class_id || !studentForm.student_no.trim() || !studentForm.full_name.trim()) {
      toast.show("请填写完整信息", "error"); return;
    }
    const ns = { id: uuid(), ...studentForm, is_active: true, created_at: now() };
    const newStudents = [...students, ns];
    saveStudents(newStudents);
    // update student_count
    const updated = classes.map(c => c.id === studentForm.class_id ? { ...c, student_count: newStudents.filter(s => s.class_id === c.id && s.is_active !== false).length } : c);
    saveClasses(updated);
    setShowAddStudent(false); setStudentForm({ class_id: "", student_no: "", full_name: "", seat_no: "" });
    toast.show("学生添加成功");
  };

  const handleBatchImport = () => {
    if (!studentForm.class_id) { toast.show("请先选择班级", "error"); return; }
    const lines = batchText.trim().split("\n").filter(l => l.trim());
    const newStudents = [];
    for (const line of lines) {
      const parts = line.split(/[,\t，]+/).map(p => p.trim());
      if (parts.length < 2) continue;
      newStudents.push({ id: uuid(), class_id: studentForm.class_id, student_no: parts[0], full_name: parts[1], seat_no: parts[2] || "", is_active: true, created_at: now() });
    }
    if (newStudents.length === 0) { toast.show("无有效数据", "error"); return; }
    const all = [...students, ...newStudents];
    saveStudents(all);
    const updated = classes.map(c => c.id === studentForm.class_id ? { ...c, student_count: all.filter(s => s.class_id === c.id && s.is_active !== false).length } : c);
    saveClasses(updated);
    setBatchText(""); setShowBatch(false);
    toast.show(`成功导入 ${newStudents.length} 名学生`);
  };

  const handleDeleteStudent = async (sid) => {
    const s = students.find(st => st.id === sid);
    const newStudents = students.filter(st => st.id !== sid);
    saveStudents(newStudents);
    if (s) {
      const updated = classes.map(c => c.id === s.class_id ? { ...c, student_count: newStudents.filter(st => st.class_id === c.id && st.is_active !== false).length } : c);
      saveClasses(updated);
    }
    toast.show("学生已删除");
  };

  const displayStudents = students.filter(s => !filterClass || s.class_id === filterClass);

  return (
    <div>
      <div className="tabs">
        <div className={`tab ${tab === "classes" ? "active" : ""}`} onClick={() => setTab("classes")}>班级管理</div>
        <div className={`tab ${tab === "students" ? "active" : ""}`} onClick={() => setTab("students")}>学生管理</div>
      </div>

      {tab === "classes" && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
            <button className="btn btn-primary" onClick={() => setShowAddClass(true)}>＋ 添加班级</button>
          </div>
          <div className="card">
            <div className="table-wrap">
              <table>
                <thead><tr><th>班级名称</th><th>年级</th><th>学生人数</th><th>操作</th></tr></thead>
                <tbody>
                  {classes.map(c => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 600 }}>{c.name}</td>
                      <td>{c.grade}</td>
                      <td>{c.student_count}</td>
                      <td><button className="btn btn-ghost btn-sm" style={{ color: "#e02424" }} onClick={() => handleDeleteClass(c.id)}>删除</button></td>
                    </tr>
                  ))}
                  {classes.length === 0 && <tr><td colSpan={4} style={{ textAlign: "center", color: "#9ca3af", padding: 32 }}>暂无班级</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === "students" && (
        <div>
          <div style={{ display: "flex", gap: 10, justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap" }}>
            <select className="form-select" style={{ maxWidth: 200 }} value={filterClass} onChange={e => setFilterClass(e.target.value)}>
              <option value="">所有班级</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-outline" onClick={() => { setShowBatch(true); }}>📋 批量导入</button>
              <button className="btn btn-primary" onClick={() => setShowAddStudent(true)}>＋ 添加学生</button>
            </div>
          </div>
          <div className="card">
            <div className="table-wrap">
              <table>
                <thead><tr><th>学号</th><th>姓名</th><th>班级</th><th>座位号</th><th>操作</th></tr></thead>
                <tbody>
                  {displayStudents.map(s => {
                    const cls = classes.find(c => c.id === s.class_id);
                    return (
                      <tr key={s.id}>
                        <td>{s.student_no}</td>
                        <td style={{ fontWeight: 500 }}>{s.full_name}</td>
                        <td><span className="badge badge-blue">{cls?.name}</span></td>
                        <td>{s.seat_no || "—"}</td>
                        <td><button className="btn btn-ghost btn-sm" style={{ color: "#e02424" }} onClick={() => handleDeleteStudent(s.id)}>删除</button></td>
                      </tr>
                    );
                  })}
                  {displayStudents.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center", color: "#9ca3af", padding: 32 }}>暂无学生</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showAddClass && (
        <Modal title="添加班级" onClose={() => setShowAddClass(false)}
          footer={<><button className="btn btn-outline" onClick={() => setShowAddClass(false)}>取消</button><button className="btn btn-primary" onClick={handleAddClass}>添加</button></>}>
          <div className="form-group">
            <label className="form-label">班级名称 *</label>
            <input className="form-input" placeholder="例：电商2301班" value={classForm.name} onChange={e => setClassForm({ ...classForm, name: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">年级</label>
            <input className="form-input" placeholder="例：2023级" value={classForm.grade} onChange={e => setClassForm({ ...classForm, grade: e.target.value })} />
          </div>
        </Modal>
      )}

      {showAddStudent && (
        <Modal title="添加学生" onClose={() => setShowAddStudent(false)}
          footer={<><button className="btn btn-outline" onClick={() => setShowAddStudent(false)}>取消</button><button className="btn btn-primary" onClick={handleAddStudent}>添加</button></>}>
          <div className="form-group">
            <label className="form-label">班级 *</label>
            <select className="form-select" value={studentForm.class_id} onChange={e => setStudentForm({ ...studentForm, class_id: e.target.value })}>
              <option value="">请选择</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">学号 *</label>
            <input className="form-input" placeholder="例：2301001" value={studentForm.student_no} onChange={e => setStudentForm({ ...studentForm, student_no: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">姓名 *</label>
            <input className="form-input" placeholder="例：张小明" value={studentForm.full_name} onChange={e => setStudentForm({ ...studentForm, full_name: e.target.value })} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">座位号（选填）</label>
            <input className="form-input" placeholder="例：A3" value={studentForm.seat_no} onChange={e => setStudentForm({ ...studentForm, seat_no: e.target.value })} />
          </div>
        </Modal>
      )}

      {showBatch && (
        <Modal title="批量导入学生" onClose={() => setShowBatch(false)}
          footer={<><button className="btn btn-outline" onClick={() => setShowBatch(false)}>取消</button><button className="btn btn-primary" onClick={handleBatchImport}>导入</button></>}>
          <div className="form-group">
            <label className="form-label">选择班级 *</label>
            <select className="form-select" value={studentForm.class_id} onChange={e => setStudentForm({ ...studentForm, class_id: e.target.value })}>
              <option value="">请选择</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">粘贴学生数据</label>
            <textarea className="form-textarea" style={{ minHeight: 160, fontFamily: "monospace", fontSize: 13 }}
              placeholder={"每行一名学生，格式：学号,姓名,座位号（座位号可选）\n示例：\n2301001,张小明,A1\n2301002,李小红,A2\n2301003,王小华"}
              value={batchText} onChange={e => setBatchText(e.target.value)} />
            <p className="form-hint">支持逗号、制表符分隔（可直接从Excel粘贴）</p>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ============================================================
// 系数配置
// ============================================================
function Settings({ data, toast }) {
  const [tiers, setTiers] = useState(DEFAULT_TIERS);

  return (
    <div>
      <div className="card" style={{ maxWidth: 560 }}>
        <div className="card-header"><span className="card-title">⚙️ 全局系数档位配置</span></div>
        <div className="card-body">
          <div className="alert alert-info" style={{ marginBottom: 16 }}>
            新发布的任务将使用以下默认档位配置，也可在任务层单独覆盖。
          </div>
          <table style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>档位名称</th><th>完成百分位上限（%）</th><th>系数</th>
              </tr>
            </thead>
            <tbody>
              {tiers.map((t, i) => (
                <tr key={i}>
                  <td><input className="form-input" value={t.label} onChange={e => { const n = [...tiers]; n[i] = { ...n[i], label: e.target.value }; setTiers(n); }} /></td>
                  <td><input className="form-input" type="number" min="1" max="100" value={t.max_percentile} onChange={e => { const n = [...tiers]; n[i] = { ...n[i], max_percentile: +e.target.value }; setTiers(n); }} /></td>
                  <td><input className="form-input" type="number" min="0" max="1" step="0.01" value={t.coef} onChange={e => { const n = [...tiers]; n[i] = { ...n[i], coef: +e.target.value }; setTiers(n); }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 16 }}>
            <button className="btn btn-primary" onClick={() => toast.show("配置已保存（演示版，刷新后恢复）")}>保存配置</button>
          </div>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 560, marginTop: 20 }}>
        <div className="card-header"><span className="card-title">📖 使用说明</span></div>
        <div className="card-body" style={{ fontSize: 13, lineHeight: 2, color: "#374151" }}>
          <p><strong>评分公式：</strong>最终分 = 基础分 × 顺序系数（封顶100分）</p>
          <p><strong>系数计算：</strong>以班级总人数为分母，按登记顺序划分档位</p>
          <p><strong>请假：</strong>直接记60分，不占用排名位置，系数不参与计算</p>
          <p><strong>未提交：</strong>任务结束后，未登记的学生自动记0分</p>
          <p><strong>补录：</strong>可随时修改成绩，系数按修改时的顺序重新计算</p>
          <p><strong>导出：</strong>成绩查询页支持导出CSV，可用Excel打开</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 主应用
// ============================================================
const PAGES = [
  { id: "dashboard", label: "仪表盘", icon: "🏠", section: "概览" },
  { id: "scoring", label: "⭐ 打分登记", icon: "✏️", section: "教学" },
  { id: "tasks", label: "任务管理", icon: "📋", section: "教学" },
  { id: "scores", label: "成绩查询", icon: "📊", section: "教学" },
  { id: "data", label: "数据管理", icon: "👥", section: "管理" },
  { id: "settings", label: "系数设置", icon: "⚙️", section: "管理" },
];

const PAGE_TITLES = {
  dashboard: { title: "仪表盘", sub: "实训课堂任务管理系统" },
  scoring: { title: "⭐ 打分登记", sub: "选择任务，逐个为学生登记成绩" },
  tasks: { title: "任务管理", sub: "发布、查看、结束课堂实训任务" },
  scores: { title: "成绩查询", sub: "查看详细成绩，支持导出CSV" },
  data: { title: "数据管理", sub: "管理班级和学生信息" },
  settings: { title: "系数设置", sub: "配置顺序系数档位" },
};

export default function App() {
  const [page, setPage] = useState("dashboard");
  const data = useData();
  const toast = useToast();

  if (!data.loaded) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 32 }}>📚</div>
        <div style={{ fontSize: 14, color: "#6b7280" }}>正在加载数据...</div>
      </div>
    );
  }

  const sections = [...new Set(PAGES.map(p => p.section))];
  const { title, sub } = PAGE_TITLES[page];

  return (
    <>
      
      <div className="app">
        {/* Sidebar */}
        <div className="sidebar">
          <div className="sidebar-logo">
            <h1>📚 实训管理</h1>
            <p>中职电商 · 课堂任务系统</p>
          </div>
          <div className="sidebar-nav">
            {sections.map(sec => (
              <div key={sec}>
                <div className="nav-section">{sec}</div>
                {PAGES.filter(p => p.section === sec).map(p => (
                  <div key={p.id} className={`nav-item ${page === p.id ? "active" : ""}`} onClick={() => setPage(p.id)}>
                    <span className="icon">{p.icon}</span>
                    <span>{p.label}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Main */}
        <div className="main">
          <div className="topbar">
            <div>
              <div className="topbar-h2" style={{ fontWeight: 600, fontSize: 16 }}>{title}</div>
              <div className="topbar-sub">{sub}</div>
            </div>
          </div>
          <div className="content">
            {page === "dashboard" && <Dashboard data={data} />}
            {page === "scoring" && <ScoringPage data={data} toast={toast} />}
            {page === "tasks" && <TaskManager data={data} toast={toast} />}
            {page === "scores" && <ScoreView data={data} toast={toast} />}
            {page === "data" && <DataManager data={data} toast={toast} />}
            {page === "settings" && <Settings data={data} toast={toast} />}
          </div>
        </div>
      </div>

      <ToastContainer toasts={toast.toasts} />
    </>
  );
}

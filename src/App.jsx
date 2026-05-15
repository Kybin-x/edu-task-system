import { useState, useEffect, useCallback, useRef } from "react";
import "./App.css";
import { supabase } from "./supabase";

// ============================================================
// 工具函数
// ============================================================
function calcCoefficient(rankNo, classTotal, tiers) {
  if (!tiers || tiers.length === 0) return { coef: 1.0, label: "无系数" };
  const pct = (rankNo / Math.max(classTotal, 1)) * 100;
  for (const tier of tiers) {
    if (pct <= tier.max_percentile) return { coef: tier.coef, label: tier.label };
  }
  const last = tiers[tiers.length - 1];
  return { coef: last.coef, label: last.label };
}

function calcFinalScore(base, coef) {
  return Math.min(100, Math.round(base * coef * 10) / 10);
}

function exportCSV(rows, filename) {
  const BOM = "\uFEFF";
  const lines = rows.map(r => r.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","));
  const blob = new Blob([BOM + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ============================================================
// 默认系数档位
// ============================================================
const DEFAULT_TIERS = [
  { max_percentile: 20, coef: 1.00, label: "优秀梯队" },
  { max_percentile: 50, coef: 0.95, label: "良好梯队" },
  { max_percentile: 80, coef: 0.90, label: "普通梯队" },
  { max_percentile: 100, coef: 0.85, label: "待提高梯队" },
];

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
  const show = useCallback((msg, type = "info") => {
    const id = Date.now();
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000);
  }, []);
  return { toasts, show };
}

// ============================================================
// 系数档位编辑器
// ============================================================
function TierEditor({ tiers, onChange }) {
  const update = (i, key, val) => {
    const next = tiers.map((t, j) => j === i ? { ...t, [key]: key === "label" ? val : parseFloat(val) || 0 } : t);
    onChange(next);
  };
  return (
    <table className="coef-table">
      <thead>
        <tr>
          <th>档位名称</th>
          <th>上限百分位(%)</th>
          <th>系数</th>
        </tr>
      </thead>
      <tbody>
        {tiers.map((t, i) => (
          <tr key={i}>
            <td><input value={t.label} onChange={e => update(i, "label", e.target.value)} /></td>
            <td><input type="number" min="1" max="100" step="1" value={t.max_percentile} onChange={e => update(i, "max_percentile", e.target.value)} /></td>
            <td><input type="number" min="0" max="2" step="0.01" value={t.coef} onChange={e => update(i, "coef", e.target.value)} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ============================================================
// Modal
// ============================================================
function Modal({ title, onClose, children, size = "" }) {
  useEffect(() => {
    const handler = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${size}`}>
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ============================================================
// 仪表盘
// ============================================================
function Dashboard({ classes, tasks, scores, onNav }) {
  const totalScores = scores.length;
  const activeTasks = tasks.filter(t => !t.is_finished).length;
  const finishedTasks = tasks.filter(t => t.is_finished).length;

  const recentTasks = [...tasks]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5);

  return (
    <div>
      <div className="grid-4" style={{ marginBottom: 24 }}>
        {[
          { label: "班级数", val: classes.length, icon: "🏫", color: "#1a56db" },
          { label: "进行中任务", val: activeTasks, icon: "📝", color: "#057a55" },
          { label: "已完成任务", val: finishedTasks, icon: "✅", color: "#6d28d9" },
          { label: "成绩记录", val: totalScores, icon: "🏆", color: "#c27803" },
        ].map(s => (
          <div className="stat-card" key={s.label}>
            <div className="stat-label">{s.icon} {s.label}</div>
            <div className="stat-value" style={{ color: s.color }}>{s.val}</div>
          </div>
        ))}
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header"><span className="card-title">📋 最近任务</span></div>
          <div className="card-body">
            {recentTasks.length === 0 ? <div className="empty"><p>暂无任务</p></div> : recentTasks.map(task => {
              const taskScores = scores.filter(s => s.task_id === task.id);
              const cls = classes.find(c => c.id === task.class_id);
              const total = cls?.student_count || 1;
              const pct = Math.round((taskScores.length / total) * 100);
              return (
                <div key={task.id} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{task.title}</span>
                    <span style={{ fontSize: 12, color: "#6b7280" }}>
                      {taskScores.length}/{total}人 · {task.is_finished ? <span style={{ color: "#6b7280" }}>已结束</span> : <span style={{ color: "#057a55" }}>进行中</span>}
                    </span>
                  </div>
                  <div className="progress-bar"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">🏫 班级概览</span></div>
          <div className="card-body">
            {classes.length === 0 ? <div className="empty"><p>暂无班级，请先在「数据管理」中添加</p></div> : classes.map(cls => {
              const clsScores = scores.filter(s => s.class_id === cls.id);
              const avg = clsScores.length > 0 ? (clsScores.reduce((a, b) => a + (b.final_score || 0), 0) / clsScores.length).toFixed(1) : "—";
              return (
                <div key={cls.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #f3f4f6" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{cls.name}</div>
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>{cls.student_count} 人</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#1a56db" }}>{avg}</div>
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>平均分</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 打分登记
// ============================================================
function ScorePage({ classes, tasks, scores, onScoreUpdate, showToast }) {
  const [selTask, setSelTask] = useState(null);
  const [students, setStudents] = useState([]);
  const [filter, setFilter] = useState("all");
  const [viewMode, setViewMode] = useState("grid");
  const [scoringStudent, setScoringStudent] = useState(null);

  useEffect(() => {
    if (selTask) {
      const cls = classes.find(c => c.id === selTask.class_id);
      if (cls) fetchStudents(cls.id);
    }
  }, [selTask]);

  async function fetchStudents(classId) {
    const { data } = await supabase.from("students").select("*").eq("class_id", classId).eq("is_active", true).order("student_no");
    setStudents(data || []);
  }

  const taskScores = selTask ? scores.filter(s => s.task_id === selTask.id) : [];

  const displayStudents = students.filter(st => {
    const sc = taskScores.find(s => s.student_id === st.id);
    if (filter === "scored") return !!sc;
    if (filter === "unscored") return !sc;
    return true;
  });

  const tierStats = selTask?.coefficient_config ? (() => {
    const tiers = selTask.coefficient_config;
    return tiers.map(tier => {
      const n = taskScores.filter(s => !s.is_leave && s.coefficient === tier.coef).length;
      return { ...tier, count: n };
    });
  })() : [];

  // 排序任务：进行中的在前
  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.is_finished !== b.is_finished) return a.is_finished ? 1 : -1;
    return new Date(b.created_at) - new Date(a.created_at);
  });

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">选择要打分的任务</label>
            <select className="form-select" value={selTask?.id || ""} onChange={e => {
              const t = tasks.find(t => t.id === e.target.value);
              setSelTask(t || null);
            }}>
              <option value="">— 请选择任务 —</option>
              {sortedTasks.map(t => {
                const cls = classes.find(c => c.id === t.class_id);
                return (
                  <option key={t.id} value={t.id}>
                    {t.is_finished ? "[已结束] " : "[进行中] "}
                    {t.title} — {cls?.name || "?"}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      </div>

      {selTask && (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="card-title">{selTask.title}</span>
                {selTask.is_finished
                  ? <span className="badge badge-yellow">补录模式</span>
                  : <span className="badge badge-green">进行中</span>
                }
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className={`btn btn-sm ${viewMode === "grid" ? "btn-primary" : "btn-outline"}`} onClick={() => setViewMode("grid")}>⊞ 宫格</button>
                <button className={`btn btn-sm ${viewMode === "list" ? "btn-primary" : "btn-outline"}`} onClick={() => setViewMode("list")}>≡ 列表</button>
              </div>
            </div>
            {tierStats.length > 0 && (
              <div style={{ padding: "10px 20px", display: "flex", gap: 12, flexWrap: "wrap", borderBottom: "1px solid #f3f4f6", background: "#fafafa" }}>
                {tierStats.map((t, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span className={`coef-tier tier-${i}`}>{t.label}</span>
                    <span style={{ fontSize: 12, color: "#6b7280" }}>{t.count}人 · ×{t.coef}</span>
                  </div>
                ))}
                <span style={{ fontSize: 12, color: "#9ca3af" }}>已登记：{taskScores.length}/{students.length}</span>
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {[["all", "全部"], ["unscored", "未登记"], ["scored", "已登记"]].map(([v, l]) => (
              <button key={v} className={`btn btn-sm ${filter === v ? "btn-primary" : "btn-outline"}`} onClick={() => setFilter(v)}>{l}</button>
            ))}
          </div>

          {viewMode === "grid" ? (
            <div className="student-grid">
              {displayStudents.map(st => {
                const sc = taskScores.find(s => s.student_id === st.id);
                const cls = sc?.is_leave ? "leave" : sc ? "scored" : "";
                return (
                  <div key={st.id} className={`student-card ${cls}`} onClick={() => setScoringStudent(st)}>
                    {sc && <span className="check">{sc.is_leave ? "🟡" : "✅"}</span>}
                    <div className="sname">{st.full_name}</div>
                    <div className="sno">{st.student_no}</div>
                    {st.seat_no && <div className="sseat">座位 {st.seat_no}</div>}
                    {sc && (
                      <>
                        <div className="sscore">{sc.final_score}分</div>
                        <div className="srank">第{sc.rank_no}个登记 · ×{sc.coefficient}</div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="card">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>学号</th><th>姓名</th><th>基础分</th><th>第几名</th><th>系数</th><th>最终分</th><th>状态</th><th>操作</th></tr>
                  </thead>
                  <tbody>
                    {displayStudents.map(st => {
                      const sc = taskScores.find(s => s.student_id === st.id);
                      return (
                        <tr key={st.id}>
                          <td>{st.student_no}</td>
                          <td>{st.full_name}</td>
                          <td>{sc ? sc.base_score : "—"}</td>
                          <td>{sc ? `第${sc.rank_no}` : "—"}</td>
                          <td>{sc ? `×${sc.coefficient}` : "—"}</td>
                          <td style={{ fontWeight: 700, color: sc ? "#057a55" : "#9ca3af" }}>{sc ? sc.final_score : "—"}</td>
                          <td>{sc ? (sc.is_leave ? <span className="badge badge-yellow">请假</span> : <span className="badge badge-green">已登记</span>) : <span className="badge badge-gray">未登记</span>}</td>
                          <td><button className="btn btn-ghost btn-sm" onClick={() => setScoringStudent(st)}>📝 {sc ? "修改" : "打分"}</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {scoringStudent && selTask && (
        <ScoreModal
          student={scoringStudent}
          task={selTask}
          existingScore={taskScores.find(s => s.student_id === scoringStudent.id)}
          allScores={taskScores}
          classTotal={students.length}
          onClose={() => setScoringStudent(null)}
          onSave={async (data) => {
            await onScoreUpdate(selTask, scoringStudent, data);
            setScoringStudent(null);
          }}
          showToast={showToast}
        />
      )}
    </div>
  );
}

// ============================================================
// 打分弹窗
// ============================================================
function ScoreModal({ student, task, existingScore, allScores, classTotal, onClose, onSave, showToast }) {
  const [baseScore, setBaseScore] = useState(existingScore?.base_score || null);
  const [isLeave, setIsLeave] = useState(existingScore?.is_leave || false);
  const [manualCoef, setManualCoef] = useState(existingScore?.is_manual_coef ? existingScore.coefficient : "");
  const [useManual, setUseManual] = useState(existingScore?.is_manual_coef || false);
  const [saving, setSaving] = useState(false);

  const baseOptions = task.base_score_options || [100, 90, 80, 70, 60];
  const tiers = task.coefficient_config || DEFAULT_TIERS;

  // 预计排名
  const currentRank = existingScore
    ? existingScore.rank_no
    : allScores.filter(s => !s.is_leave).length + 1;

  const previewCoef = useManual && manualCoef ? parseFloat(manualCoef) : (isLeave ? null : calcCoefficient(currentRank, classTotal, tiers).coef);
  const previewLabel = useManual ? "手动覆盖" : (isLeave ? "请假" : calcCoefficient(currentRank, classTotal, tiers).label);
  const previewFinal = isLeave ? 60 : (baseScore && previewCoef ? calcFinalScore(baseScore, previewCoef) : null);

  async function handleSave() {
    if (!isLeave && baseScore === null) { showToast("请选择基础分", "error"); return; }
    setSaving(true);
    await onSave({ baseScore: isLeave ? 60 : baseScore, isLeave, manualCoef: useManual ? parseFloat(manualCoef) : undefined, rankNo: currentRank });
    setSaving(false);
  }

  return (
    <Modal title={`打分：${student.full_name}（${student.student_no}）`} onClose={onClose}>
      <div className="modal-body">
        {isLeave ? (
          <div className="alert alert-warning">请假登记：固定60分，不占排名序号</div>
        ) : (
          <>
            <div className="form-group">
              <label className="form-label">基础分</label>
              <div className="score-options">
                {baseOptions.map(s => (
                  <button key={s} className={`score-opt ${baseScore === s ? "selected" : ""}`} onClick={() => setBaseScore(s)}>{s}</button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={useManual} onChange={e => setUseManual(e.target.checked)} />
                手动覆盖系数
              </label>
              {useManual && (
                <input type="number" min="0" max="2" step="0.01" className="form-input" style={{ marginTop: 8, width: 120 }}
                  value={manualCoef} onChange={e => setManualCoef(e.target.value)} placeholder="如 0.95" />
              )}
            </div>
          </>
        )}

        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 16 }}>
          <input type="checkbox" checked={isLeave} onChange={e => setIsLeave(e.target.checked)} />
          本次请假（固定60分，不占排名）
        </label>

        <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>预览</div>
          <div style={{ display: "flex", gap: 20 }}>
            <div><div style={{ fontSize: 11, color: "#9ca3af" }}>排名序号</div><div style={{ fontSize: 18, fontWeight: 700 }}>第{currentRank}个</div></div>
            <div><div style={{ fontSize: 11, color: "#9ca3af" }}>档位</div><div style={{ fontSize: 13, fontWeight: 600, color: "#6d28d9" }}>{previewLabel}</div></div>
            <div><div style={{ fontSize: 11, color: "#9ca3af" }}>系数</div><div style={{ fontSize: 18, fontWeight: 700 }}>×{isLeave ? "—" : (previewCoef?.toFixed(2) || "—")}</div></div>
            <div><div style={{ fontSize: 11, color: "#9ca3af" }}>最终分</div><div style={{ fontSize: 24, fontWeight: 700, color: "#057a55" }}>{previewFinal ?? "—"}</div></div>
          </div>
        </div>
      </div>
      <div className="modal-footer">
        <button className="btn btn-outline" onClick={onClose}>取消</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? "保存中..." : "确认登记"}</button>
      </div>
    </Modal>
  );
}

// ============================================================
// 任务管理
// ============================================================
function TaskPage({ classes, tasks, scores, onRefresh, showToast }) {
  const [showCreate, setShowCreate] = useState(false);
  const [editingTiers, setEditingTiers] = useState(null); // task
  const [delTask, setDelTask] = useState(null);

  async function handleFinish(task) {
    if (!confirm(`结束「${task.title}」登记？未登记的学生将自动记0分。`)) return;
    // 先获取该班所有学生
    const { data: studs } = await supabase.from("students").select("*").eq("class_id", task.class_id).eq("is_active", true);
    const taskScores = scores.filter(s => s.task_id === task.id);
    const unscored = (studs || []).filter(s => !taskScores.find(sc => sc.student_id === s.id));
    if (unscored.length > 0) {
      const inserts = unscored.map(st => ({
        task_id: task.id, student_id: st.id, class_id: task.class_id,
        base_score: 0, rank_no: 9999, coefficient: 0, final_score: 0,
        is_leave: false, is_absent: true,
      }));
      await supabase.from("scores").insert(inserts);
    }
    await supabase.from("tasks").update({ is_finished: true }).eq("id", task.id);
    showToast(`已结束，${unscored.length}名学生自动记0分`, "success");
    onRefresh();
  }

  async function handleReopen(task) {
    await supabase.from("tasks").update({ is_finished: false }).eq("id", task.id);
    showToast("已重新开放，可继续补录", "success");
    onRefresh();
  }

  async function handleDelete(task) {
    await supabase.from("tasks").delete().eq("id", task.id);
    showToast("任务已删除", "success");
    setDelTask(null);
    onRefresh();
  }

  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.is_finished !== b.is_finished) return a.is_finished ? 1 : -1;
    return new Date(b.created_at) - new Date(a.created_at);
  });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>＋ 发布新任务</button>
      </div>

      {sortedTasks.length === 0 ? (
        <div className="card"><div className="empty"><div className="empty-icon">📋</div><p>还没有任务，点击「发布新任务」开始</p></div></div>
      ) : sortedTasks.map(task => {
        const cls = classes.find(c => c.id === task.class_id);
        const taskScores = scores.filter(s => s.task_id === task.id && !s.is_absent);
        const total = cls?.student_count || 0;
        const pct = total ? Math.round((taskScores.length / total) * 100) : 0;
        const tiers = task.coefficient_config || DEFAULT_TIERS;

        return (
          <div className="card" key={task.id} style={{ marginBottom: 12 }}>
            <div className="card-header">
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="card-title">{task.title}</span>
                  {task.is_finished
                    ? <span className="badge badge-gray">已结束</span>
                    : <span className="badge badge-green">进行中</span>
                  }
                </div>
                <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 3 }}>
                  {cls?.name} · 已登记 {taskScores.length}/{total} 人
                  {task.description && ` · ${task.description}`}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="btn btn-outline btn-sm" onClick={() => setEditingTiers(task)}>⚙ 系数</button>
                {!task.is_finished
                  ? <button className="btn btn-outline btn-sm" onClick={() => handleFinish(task)}>🔒 结束登记</button>
                  : <button className="btn btn-outline btn-sm" onClick={() => handleReopen(task)}>🔓 重新开放</button>
                }
                <button className="btn btn-danger btn-sm" onClick={() => setDelTask(task)}>删除</button>
              </div>
            </div>
            <div style={{ padding: "10px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#9ca3af", marginBottom: 4 }}>
                <span>打分进度</span><span>{pct}%</span>
              </div>
              <div className="progress-bar"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
              <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {tiers.map((t, i) => (
                  <span key={i} className={`coef-tier tier-${i}`}>{t.label}×{t.coef}</span>
                ))}
              </div>
            </div>
          </div>
        );
      })}

      {showCreate && (
        <CreateTaskModal classes={classes} onClose={() => setShowCreate(false)} onSave={async () => { setShowCreate(false); onRefresh(); }} showToast={showToast} />
      )}

      {editingTiers && (
        <EditTiersModal task={editingTiers} onClose={() => setEditingTiers(null)} onSave={async () => { setEditingTiers(null); onRefresh(); }} showToast={showToast} />
      )}

      {delTask && (
        <Modal title="确认删除" onClose={() => setDelTask(null)}>
          <div className="modal-body">
            <p>确定删除任务「{delTask.title}」？所有相关成绩将一并删除，此操作不可撤销。</p>
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline" onClick={() => setDelTask(null)}>取消</button>
            <button className="btn btn-danger" onClick={() => handleDelete(delTask)}>确认删除</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ============================================================
// 发布任务弹窗
// ============================================================
function CreateTaskModal({ classes, onClose, onSave, showToast }) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [classId, setClassId] = useState("");
  const [baseOpts, setBaseOpts] = useState("100,90,80,70,60");
  const [tiers, setTiers] = useState(JSON.parse(JSON.stringify(DEFAULT_TIERS)));
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!title.trim()) { showToast("请填写任务名称", "error"); return; }
    if (!classId) { showToast("请选择班级", "error"); return; }
    setSaving(true);
    const opts = baseOpts.split(",").map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
    const { error } = await supabase.from("tasks").insert({
      title: title.trim(), description: desc.trim() || null,
      class_id: classId,
      base_score_options: opts,
      coefficient_config: tiers,
      is_finished: false,
    });
    if (error) { showToast("保存失败：" + error.message, "error"); setSaving(false); return; }
    showToast("任务发布成功", "success");
    onSave();
  }

  return (
    <Modal title="发布新任务" onClose={onClose} size="modal-lg">
      <div className="modal-body">
        <div className="form-group">
          <label className="form-label">任务名称 *</label>
          <input className="form-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="如：淘宝首页设计实训" />
        </div>
        <div className="form-group">
          <label className="form-label">班级 *</label>
          <select className="form-select" value={classId} onChange={e => setClassId(e.target.value)}>
            <option value="">— 选择班级 —</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">任务说明</label>
          <textarea className="form-textarea" value={desc} onChange={e => setDesc(e.target.value)} placeholder="可选" />
        </div>
        <div className="form-group">
          <label className="form-label">基础分选项（逗号分隔）</label>
          <input className="form-input" value={baseOpts} onChange={e => setBaseOpts(e.target.value)} placeholder="100,90,80,70,60" />
        </div>
        <div className="form-group">
          <label className="form-label">本任务系数档位设置</label>
          <TierEditor tiers={tiers} onChange={setTiers} />
        </div>
      </div>
      <div className="modal-footer">
        <button className="btn btn-outline" onClick={onClose}>取消</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? "发布中..." : "发布任务"}</button>
      </div>
    </Modal>
  );
}

// ============================================================
// 编辑系数弹窗
// ============================================================
function EditTiersModal({ task, onClose, onSave, showToast }) {
  const [tiers, setTiers] = useState(JSON.parse(JSON.stringify(task.coefficient_config || DEFAULT_TIERS)));
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const { error } = await supabase.from("tasks").update({ coefficient_config: tiers }).eq("id", task.id);
    if (error) { showToast("保存失败", "error"); setSaving(false); return; }
    showToast("系数更新成功", "success");
    onSave();
  }

  return (
    <Modal title={`编辑系数：${task.title}`} onClose={onClose}>
      <div className="modal-body">
        <div className="alert alert-info" style={{ marginBottom: 16 }}>修改系数不影响已登记的成绩，仅对后续新登记生效。</div>
        <TierEditor tiers={tiers} onChange={setTiers} />
      </div>
      <div className="modal-footer">
        <button className="btn btn-outline" onClick={onClose}>取消</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? "保存中..." : "保存"}</button>
      </div>
    </Modal>
  );
}

// ============================================================
// 成绩查询
// ============================================================
function ScoreQueryPage({ classes, tasks, scores, showToast }) {
  const [selClass, setSelClass] = useState("");
  const [selTask, setSelTask] = useState("all");
  const [studs, setStuds] = useState([]);

  useEffect(() => {
    if (selClass) {
      supabase.from("students").select("*").eq("class_id", selClass).eq("is_active", true).order("student_no")
        .then(({ data }) => setStuds(data || []));
    } else {
      setStuds([]);
    }
  }, [selClass]);

  const classTasks = tasks.filter(t => t.class_id === selClass);
  const classScores = scores.filter(s => s.class_id === selClass);

  function exportAll() {
    if (!studs.length) return;
    const headers = ["学号", "姓名", ...classTasks.map(t => t.title + "_最终分"), "平均分"];
    const rows = studs.map(st => {
      const stScores = classTasks.map(t => {
        const sc = classScores.find(s => s.student_id === st.id && s.task_id === t.id);
        return sc ? sc.final_score : "";
      });
      const valid = stScores.filter(s => s !== "");
      const avg = valid.length ? (valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(1) : "";
      return [st.student_no, st.full_name, ...stScores, avg];
    });
    exportCSV([headers, ...rows], `${classes.find(c => c.id === selClass)?.name}_全班成绩汇总.csv`);
    showToast("导出成功", "success");
  }

  function exportSingle() {
    if (selTask === "all") return;
    const task = tasks.find(t => t.id === selTask);
    if (!task || !studs.length) return;
    const headers = ["学号", "姓名", "基础分", "排名序号", "档位系数", "最终分", "备注"];
    const rows = studs.map(st => {
      const sc = classScores.find(s => s.student_id === st.id && s.task_id === selTask);
      if (!sc) return [st.student_no, st.full_name, "未登记", "", "", "", ""];
      return [st.student_no, st.full_name, sc.base_score, sc.rank_no, sc.coefficient, sc.final_score, sc.is_leave ? "请假" : (sc.is_absent ? "缺席" : "")];
    });
    exportCSV([headers, ...rows], `${classes.find(c => c.id === selClass)?.name}_${task.title}.csv`);
    showToast("导出成功", "success");
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body">
          <div className="grid-2">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">选择班级</label>
              <select className="form-select" value={selClass} onChange={e => { setSelClass(e.target.value); setSelTask("all"); }}>
                <option value="">— 选择班级 —</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">查看范围</label>
              <select className="form-select" value={selTask} onChange={e => setSelTask(e.target.value)} disabled={!selClass}>
                <option value="all">📊 全班汇总（所有任务）</option>
                {classTasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {selClass && (
        <>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 12 }}>
            <button className="btn btn-success btn-sm" onClick={exportAll}>⬇ 导出全班汇总CSV</button>
            {selTask !== "all" && <button className="btn btn-outline btn-sm" onClick={exportSingle}>⬇ 导出当前任务CSV</button>}
          </div>

          {selTask === "all" ? (
            <AllScoreTable studs={studs} tasks={classTasks} scores={classScores} />
          ) : (
            <SingleTaskTable task={tasks.find(t => t.id === selTask)} studs={studs} scores={classScores} />
          )}
        </>
      )}

      {!selClass && <div className="card"><div className="empty"><div className="empty-icon">📊</div><p>请选择班级查看成绩</p></div></div>}
    </div>
  );
}

function AllScoreTable({ studs, tasks, scores }) {
  if (!tasks.length) return <div className="card"><div className="empty"><p>该班级暂无任务</p></div></div>;

  const rows = studs.map(st => {
    const stScores = tasks.map(t => scores.find(s => s.student_id === st.id && s.task_id === t.id));
    const valid = stScores.filter(s => s && !s.is_absent).map(s => s.final_score);
    const avg = valid.length ? (valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(1) : null;
    return { st, stScores, avg };
  }).sort((a, b) => (parseFloat(b.avg) || 0) - (parseFloat(a.avg) || 0));

  return (
    <div className="card">
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>排名</th><th>学号</th><th>姓名</th>
              {tasks.map(t => <th key={t.id} style={{ maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={t.title}>{t.title}</th>)}
              <th>平均分</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ st, stScores, avg }, idx) => (
              <tr key={st.id}>
                <td style={{ fontWeight: 700, color: idx < 3 ? "#c27803" : "#9ca3af" }}>#{idx + 1}</td>
                <td>{st.student_no}</td>
                <td>{st.full_name}</td>
                {stScores.map((sc, i) => (
                  <td key={i} style={{ textAlign: "center" }}>
                    {sc ? (sc.is_absent ? <span className="badge badge-gray">0</span> : sc.is_leave ? <span className="badge badge-yellow">假/60</span> : <span style={{ fontWeight: 600 }}>{sc.final_score}</span>) : <span style={{ color: "#d1d5db" }}>—</span>}
                  </td>
                ))}
                <td style={{ fontWeight: 700, color: "#1a56db" }}>{avg ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SingleTaskTable({ task, studs, scores }) {
  if (!task) return null;
  const taskScores = scores.filter(s => s.task_id === task.id);
  const sortedStuds = [...studs].sort((a, b) => {
    const sa = taskScores.find(s => s.student_id === a.id);
    const sb = taskScores.find(s => s.student_id === b.id);
    if (!sa && !sb) return 0;
    if (!sa) return 1;
    if (!sb) return -1;
    return (sb.final_score || 0) - (sa.final_score || 0);
  });

  return (
    <div className="card">
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>学号</th><th>姓名</th><th>登记序号</th><th>基础分</th><th>系数</th><th>最终分</th><th>状态</th></tr>
          </thead>
          <tbody>
            {sortedStuds.map(st => {
              const sc = taskScores.find(s => s.student_id === st.id);
              return (
                <tr key={st.id}>
                  <td>{st.student_no}</td>
                  <td>{st.full_name}</td>
                  <td>{sc && !sc.is_absent ? `第${sc.rank_no}个` : "—"}</td>
                  <td>{sc ? sc.base_score : "—"}</td>
                  <td>{sc && !sc.is_absent ? `×${sc.coefficient}` : "—"}</td>
                  <td style={{ fontWeight: 700, color: sc ? "#057a55" : "#9ca3af" }}>{sc ? sc.final_score : "未登记"}</td>
                  <td>{!sc ? <span className="badge badge-gray">未登记</span> : sc.is_absent ? <span className="badge badge-red">缺席0分</span> : sc.is_leave ? <span className="badge badge-yellow">请假60分</span> : <span className="badge badge-green">已登记</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// 数据管理
// ============================================================
function DataPage({ classes, onRefresh, showToast }) {
  const [tab, setTab] = useState("class");
  const [selClass, setSelClass] = useState("");
  const [students, setStudents] = useState([]);
  const [showAddClass, setShowAddClass] = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [showBulk, setShowBulk] = useState(false);

  useEffect(() => {
    if (selClass) fetchStudents(selClass);
  }, [selClass]);

  async function fetchStudents(cid) {
    const { data } = await supabase.from("students").select("*").eq("class_id", cid).order("student_no");
    setStudents(data || []);
  }

  async function deleteClass(cls) {
    if (!confirm(`删除班级「${cls.name}」将同时删除该班所有学生和成绩！`)) return;
    await supabase.from("classes").delete().eq("id", cls.id);
    showToast("班级已删除", "success");
    if (selClass === cls.id) setSelClass("");
    onRefresh();
  }

  async function deleteStudent(st) {
    if (!confirm(`确认删除学生「${st.full_name}」？`)) return;
    await supabase.from("students").delete().eq("id", st.id);
    showToast("学生已删除", "success");
    fetchStudents(selClass);
    onRefresh();
  }

  async function handleBulkImport() {
    const lines = bulkText.trim().split("\n").map(l => l.trim()).filter(Boolean);
    let ok = 0, skip = 0;
    for (const line of lines) {
      const parts = line.split(/[\t,，\s]+/).filter(Boolean);
      if (parts.length < 2) { skip++; continue; }
      const [student_no, full_name, seat_no] = parts;
      const { error } = await supabase.from("students").upsert(
        { class_id: selClass, student_no, full_name, seat_no: seat_no || null, is_active: true },
        { onConflict: "class_id,student_no" }
      );
      if (error) skip++; else ok++;
    }
    // 更新 student_count
    const { data: cnt } = await supabase.from("students").select("id", { count: "exact" }).eq("class_id", selClass).eq("is_active", true);
    await supabase.from("classes").update({ student_count: cnt?.length || 0 }).eq("id", selClass);
    showToast(`导入完成：成功${ok}人，跳过${skip}行`, ok > 0 ? "success" : "error");
    setShowBulk(false);
    setBulkText("");
    fetchStudents(selClass);
    onRefresh();
  }

  return (
    <div>
      <div className="tabs">
        <div className={`tab ${tab === "class" ? "active" : ""}`} onClick={() => setTab("class")}>🏫 班级管理</div>
        <div className={`tab ${tab === "student" ? "active" : ""}`} onClick={() => setTab("student")}>👥 学生管理</div>
      </div>

      {tab === "class" && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
            <button className="btn btn-primary" onClick={() => setShowAddClass(true)}>＋ 添加班级</button>
          </div>
          <div className="card">
            <div className="table-wrap">
              <table>
                <thead><tr><th>班级名称</th><th>年级</th><th>学生人数</th><th>操作</th></tr></thead>
                <tbody>
                  {classes.map(cls => (
                    <tr key={cls.id}>
                      <td style={{ fontWeight: 500 }}>{cls.name}</td>
                      <td>{cls.grade || "—"}</td>
                      <td>{cls.student_count}</td>
                      <td><button className="btn btn-danger btn-sm" onClick={() => deleteClass(cls)}>删除</button></td>
                    </tr>
                  ))}
                  {classes.length === 0 && <tr><td colSpan={4} style={{ textAlign: "center", color: "#9ca3af", padding: 32 }}>暂无班级</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {showAddClass && <AddClassModal onClose={() => setShowAddClass(false)} onSave={async () => { setShowAddClass(false); onRefresh(); }} showToast={showToast} />}
        </div>
      )}

      {tab === "student" && (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
            <select className="form-select" style={{ width: 180 }} value={selClass} onChange={e => setSelClass(e.target.value)}>
              <option value="">— 选择班级 —</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {selClass && (
              <>
                <button className="btn btn-primary" onClick={() => setShowAddStudent(true)}>＋ 添加学生</button>
                <button className="btn btn-outline" onClick={() => setShowBulk(true)}>📋 批量导入</button>
              </>
            )}
          </div>

          {selClass ? (
            <div className="card">
              <div className="table-wrap">
                <table>
                  <thead><tr><th>学号</th><th>姓名</th><th>座位号</th><th>状态</th><th>操作</th></tr></thead>
                  <tbody>
                    {students.map(st => (
                      <tr key={st.id}>
                        <td>{st.student_no}</td>
                        <td style={{ fontWeight: 500 }}>{st.full_name}</td>
                        <td>{st.seat_no || "—"}</td>
                        <td>{st.is_active ? <span className="badge badge-green">在读</span> : <span className="badge badge-gray">已离校</span>}</td>
                        <td><button className="btn btn-danger btn-sm" onClick={() => deleteStudent(st)}>删除</button></td>
                      </tr>
                    ))}
                    {students.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center", color: "#9ca3af", padding: 32 }}>暂无学生，请批量导入</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          ) : <div className="card"><div className="empty"><p>请先选择班级</p></div></div>}

          {showAddStudent && selClass && (
            <AddStudentModal classId={selClass} onClose={() => setShowAddStudent(false)} onSave={async () => { setShowAddStudent(false); fetchStudents(selClass); onRefresh(); }} showToast={showToast} />
          )}

          {showBulk && (
            <Modal title="批量导入学生" onClose={() => setShowBulk(false)}>
              <div className="modal-body">
                <div className="alert alert-info">每行一个学生，格式：<b>学号 姓名 座位号(可选)</b>，支持空格、逗号、Tab分隔。重复学号自动覆盖。</div>
                <div className="form-group">
                  <textarea className="form-textarea" style={{ minHeight: 200, fontFamily: "monospace" }} value={bulkText} onChange={e => setBulkText(e.target.value)} placeholder={"2024001 张三 A01\n2024002 李四\n2024003,王五,B03"} />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline" onClick={() => setShowBulk(false)}>取消</button>
                <button className="btn btn-primary" onClick={handleBulkImport}>开始导入</button>
              </div>
            </Modal>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// 添加班级弹窗
// ============================================================
function AddClassModal({ onClose, onSave, showToast }) {
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) { showToast("请填写班级名称", "error"); return; }
    setSaving(true);
    const { error } = await supabase.from("classes").insert({ name: name.trim(), grade: grade.trim() || null, student_count: 0 });
    if (error) { showToast("保存失败：" + error.message, "error"); setSaving(false); return; }
    showToast("班级添加成功", "success");
    onSave();
  }

  return (
    <Modal title="添加班级" onClose={onClose}>
      <div className="modal-body">
        <div className="form-group">
          <label className="form-label">班级名称 *</label>
          <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="如：2024电商1班" />
        </div>
        <div className="form-group">
          <label className="form-label">年级</label>
          <input className="form-input" value={grade} onChange={e => setGrade(e.target.value)} placeholder="如：2024级" />
        </div>
      </div>
      <div className="modal-footer">
        <button className="btn btn-outline" onClick={onClose}>取消</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? "保存中..." : "添加"}</button>
      </div>
    </Modal>
  );
}

// ============================================================
// 添加单个学生
// ============================================================
function AddStudentModal({ classId, onClose, onSave, showToast }) {
  const [no, setNo] = useState("");
  const [name, setName] = useState("");
  const [seat, setSeat] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!no.trim() || !name.trim()) { showToast("请填写学号和姓名", "error"); return; }
    setSaving(true);
    const { error } = await supabase.from("students").upsert(
      { class_id: classId, student_no: no.trim(), full_name: name.trim(), seat_no: seat.trim() || null, is_active: true },
      { onConflict: "class_id,student_no" }
    );
    if (error) { showToast("保存失败：" + error.message, "error"); setSaving(false); return; }
    // 更新 student_count
    const { data: cnt } = await supabase.from("students").select("id", { count: "exact" }).eq("class_id", classId).eq("is_active", true);
    await supabase.from("classes").update({ student_count: cnt?.length || 0 }).eq("id", classId);
    showToast("学生添加成功", "success");
    onSave();
  }

  return (
    <Modal title="添加学生" onClose={onClose}>
      <div className="modal-body">
        <div className="form-group">
          <label className="form-label">学号 *</label>
          <input className="form-input" value={no} onChange={e => setNo(e.target.value)} placeholder="如：2024001" />
        </div>
        <div className="form-group">
          <label className="form-label">姓名 *</label>
          <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="如：张三" />
        </div>
        <div className="form-group">
          <label className="form-label">座位号</label>
          <input className="form-input" value={seat} onChange={e => setSeat(e.target.value)} placeholder="如：A01（可选）" />
        </div>
      </div>
      <div className="modal-footer">
        <button className="btn btn-outline" onClick={onClose}>取消</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? "保存中..." : "添加"}</button>
      </div>
    </Modal>
  );
}

// ============================================================
// 系数设置
// ============================================================
function SettingsPage({ showToast }) {
  const [tiers, setTiers] = useState(JSON.parse(JSON.stringify(DEFAULT_TIERS)));

  const setupSQL = `-- 在 Supabase SQL Editor 执行（一次性）
create table if not exists classes (
  id uuid primary key default gen_random_uuid(),
  name text not null, grade text,
  student_count int default 0,
  created_at timestamptz default now()
);
create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  student_no text not null, full_name text not null,
  seat_no text, is_active boolean default true,
  created_at timestamptz default now(),
  unique(class_id, student_no)
);
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  title text not null, description text,
  base_score_options jsonb default '[100,90,80,70,60]',
  coefficient_config jsonb,
  is_finished boolean default false,
  created_at timestamptz default now()
);
create table if not exists scores (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  base_score numeric(5,1), rank_no int,
  coefficient numeric(4,3), final_score numeric(5,1),
  is_manual_coef boolean default false,
  is_leave boolean default false,
  is_absent boolean default false,
  remark text, scored_at timestamptz default now(),
  unique(task_id, student_id)
);
-- RLS 开放策略（单教师场景）
alter table classes enable row level security;
alter table students enable row level security;
alter table tasks enable row level security;
alter table scores enable row level security;
create policy "allow_all" on classes for all using (true) with check (true);
create policy "allow_all" on students for all using (true) with check (true);
create policy "allow_all" on tasks for all using (true) with check (true);
create policy "allow_all" on scores for all using (true) with check (true);`;

  return (
    <div>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header"><span className="card-title">⚙ 全局默认系数档位</span></div>
        <div className="card-body">
          <div className="alert alert-info" style={{ marginBottom: 16 }}>此处设置的是发布任务时的默认档位，每个任务发布后可单独修改。</div>
          <TierEditor tiers={tiers} onChange={setTiers} />
          <div style={{ marginTop: 12 }}>
            <button className="btn btn-primary" onClick={() => showToast("已记录（刷新页面前有效）", "info")}>保存默认配置</button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">🗄 数据库建表 SQL</span></div>
        <div className="card-body">
          <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>如尚未建表，请复制以下 SQL 到 Supabase → SQL Editor → 执行：</p>
          <pre style={{ background: "#1e293b", color: "#e2e8f0", borderRadius: 8, padding: 16, fontSize: 12, overflowX: "auto", whiteSpace: "pre-wrap" }}>{setupSQL}</pre>
          <button className="btn btn-outline" style={{ marginTop: 12 }} onClick={() => { navigator.clipboard.writeText(setupSQL); showToast("SQL 已复制到剪贴板", "success"); }}>📋 复制 SQL</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 主应用
// ============================================================
export default function App() {
  const [page, setPage] = useState("dashboard");
  const [classes, setClasses] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState(false);
  const { toasts, show: showToast } = useToast();

  const fetchAll = useCallback(async () => {
    try {
      const [{ data: cls, error: e1 }, { data: tsk, error: e2 }, { data: sc, error: e3 }] = await Promise.all([
        supabase.from("classes").select("*").order("created_at"),
        supabase.from("tasks").select("*").order("created_at", { ascending: false }),
        supabase.from("scores").select("*"),
      ]);
      if (e1 || e2 || e3) {
        setDbError(true);
        setLoading(false);
        return;
      }
      setClasses(cls || []);
      setTasks(tsk || []);
      setScores(sc || []);
      setDbError(false);
    } catch {
      setDbError(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function handleScoreUpdate(task, student, { baseScore, isLeave, manualCoef, rankNo }) {
    const existing = scores.find(s => s.task_id === task.id && s.student_id === student.id);
    const tiers = task.coefficient_config || DEFAULT_TIERS;

    let coef, finalScore;
    if (isLeave) {
      coef = null; finalScore = 60;
    } else {
      if (manualCoef !== undefined) {
        coef = manualCoef;
      } else {
        // 实际排名：排除请假的
        const realRank = existing
          ? existing.rank_no
          : scores.filter(s => s.task_id === task.id && !s.is_leave).length + 1;
        const cls = classes.find(c => c.id === task.class_id);
        coef = calcCoefficient(realRank, cls?.student_count || 1, tiers).coef;
      }
      finalScore = calcFinalScore(baseScore, coef);
    }

    const payload = {
      task_id: task.id, student_id: student.id, class_id: task.class_id,
      base_score: baseScore, rank_no: isLeave ? null : rankNo,
      coefficient: coef, final_score: finalScore,
      is_manual_coef: manualCoef !== undefined,
      is_leave: isLeave, is_absent: false,
      scored_at: new Date().toISOString(),
    };

    if (existing) {
      await supabase.from("scores").update(payload).eq("id", existing.id);
      showToast("成绩已更新", "success");
    } else {
      await supabase.from("scores").insert(payload);
      showToast("成绩登记成功", "success");
    }
    fetchAll();
  }

  if (loading) return (
    <div className="loading-screen">
      <div className="spinner" />
      <p style={{ color: "#6b7280" }}>连接数据库中...</p>
    </div>
  );

  if (dbError) return (
    <div className="setup-screen">
      <div className="setup-card">
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>⚠ 数据库未就绪</h2>
        <p style={{ color: "#6b7280", marginBottom: 16 }}>无法连接到数据库或表尚未创建。请前往 <b>Supabase → SQL Editor</b> 执行建表语句。</p>
        <p style={{ color: "#6b7280", fontSize: 13 }}>建表 SQL 可在「系数设置」页面查看和复制。</p>
        <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => { setLoading(true); fetchAll(); }}>重试连接</button>
      </div>
    </div>
  );

  const navItems = [
    { section: "概览", items: [{ id: "dashboard", label: "仪表盘", icon: "🏠" }] },
    { section: "教学", items: [
      { id: "score", label: "✏️⭐ 打分登记", icon: "✏" },
      { id: "tasks", label: "任务管理", icon: "📋" },
      { id: "query", label: "成绩查询", icon: "📊" },
    ]},
    { section: "管理", items: [
      { id: "data", label: "数据管理", icon: "👥" },
      { id: "settings", label: "系数设置", icon: "⚙" },
    ]},
  ];

  const pageTitle = {
    dashboard: "仪表盘", score: "打分登记", tasks: "任务管理",
    query: "成绩查询", data: "数据管理", settings: "系数设置",
  }[page];

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1>📚 实训管理</h1>
          <p>中职电商 · 课堂任务系统</p>
        </div>
        <nav className="sidebar-nav">
          {navItems.map(sec => (
            <div key={sec.section}>
              <div className="nav-section">{sec.section}</div>
              {sec.items.map(item => (
                <div key={item.id} className={`nav-item ${page === item.id ? "active" : ""}`} onClick={() => setPage(item.id)}>
                  <span className="icon">{item.icon}</span>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <main className="main">
        <div className="topbar">
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>{pageTitle}</h2>
          <div style={{ fontSize: 12, color: "#9ca3af" }}>
            {classes.length}个班级 · {tasks.filter(t => !t.is_finished).length}个进行中任务
          </div>
        </div>
        <div className="content">
          {page === "dashboard" && <Dashboard classes={classes} tasks={tasks} scores={scores} onNav={setPage} />}
          {page === "score" && <ScorePage classes={classes} tasks={tasks} scores={scores} onScoreUpdate={handleScoreUpdate} showToast={showToast} />}
          {page === "tasks" && <TaskPage classes={classes} tasks={tasks} scores={scores} onRefresh={fetchAll} showToast={showToast} />}
          {page === "query" && <ScoreQueryPage classes={classes} tasks={tasks} scores={scores} showToast={showToast} />}
          {page === "data" && <DataPage classes={classes} onRefresh={fetchAll} showToast={showToast} />}
          {page === "settings" && <SettingsPage showToast={showToast} />}
        </div>
      </main>

      <ToastContainer toasts={toasts} />
    </div>
  );
}

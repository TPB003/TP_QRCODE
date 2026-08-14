import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ProjectShell } from "@client/components/layout/project-shell";
import { api } from "@client/lib/api";

export function Component() {
  const { projectId = "" } = useParams();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"active" | "paused">("active");
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState("");
  useEffect(() => { void api.project(projectId).then(({ project }) => { setName(project.name); setStatus(project.status === "paused" ? "paused" : "active"); setRevision(project.revision); }).catch(() => navigate("/login")); }, [navigate, projectId]);

  async function save() {
    try {
      const project = await api.updateProject(projectId, revision, { name, status });
      setRevision(project.revision);
      setNotice("项目设置已保存");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "保存失败");
    }
  }

  return <ProjectShell><section className="settings-view paper-panel"><p className="index-label">11 / PROJECT SETTINGS</p><h1>项目设置</h1><label>项目名称<input value={name} onChange={(event) => setName(event.target.value)} /></label><label>公共访问状态<select value={status} onChange={(event) => setStatus(event.target.value as "active" | "paused")}><option value="active">已启用</option><option value="paused">已暂停</option></select></label><button type="button" onClick={() => void save()}>保存设置</button>{notice ? <p role="status">{notice}</p> : null}</section></ProjectShell>;
}

import React, { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Button } from "../input/Button";
import { Column } from "../layout/Column";
import styles from "./WorksheetPanel.scss";

function StepList({ steps, completedSteps, onToggleStep }) {
  return (
    <div className={styles.stepList}>
      {steps.map((step, i) => {
        const done = completedSteps.includes(i);
        return (
          <div key={i} className={`${styles.stepRow} ${done ? styles.stepDone : ""}`}>
            <input
              type="checkbox"
              className={styles.stepCheckbox}
              checked={done}
              onChange={() => onToggleStep(i)}
            />
            <span className={styles.stepTitle}>{step.title || `Step ${i + 1}`}</span>
            {step.type && <span className={styles.stepBadge}>{step.type}</span>}
          </div>
        );
      })}
    </div>
  );
}

function StudentView({ channel, worksheets }) {
  const [completedMap, setCompletedMap] = useState({});
  const [expanded, setExpanded] = useState(null);

  const toggleStep = useCallback(
    (wsId, stepIndex) => {
      setCompletedMap(prev => {
        const steps = prev[wsId] || [];
        const updated = steps.includes(stepIndex)
          ? steps.filter(i => i !== stepIndex)
          : [...steps, stepIndex];
        return { ...prev, [wsId]: updated };
      });
      channel.trackProgress(`ws.${wsId}`, "worksheet", { status: "started" });
    },
    [channel]
  );

  if (worksheets.length === 0) {
    return <div className={styles.noData}>No worksheets available</div>;
  }

  return (
    <div>
      {worksheets.map(ws => {
        const completedSteps = completedMap[ws.worksheet_id] || [];
        const steps = ws.steps || [];
        const isExpanded = expanded === ws.worksheet_id;
        return (
          <div key={ws.worksheet_id} className={styles.worksheetCard}>
            <div className={styles.worksheetTitle}>{ws.title}</div>
            <div className={styles.stepCount}>
              {completedSteps.length}/{steps.length} steps done
            </div>
            {isExpanded && (
              <StepList
                steps={steps}
                completedSteps={completedSteps}
                onToggleStep={i => toggleStep(ws.worksheet_id, i)}
              />
            )}
            {steps.length > 0 && (
              <Button onClick={() => setExpanded(isExpanded ? null : ws.worksheet_id)}>
                {isExpanded ? "Collapse" : "Open"}
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TeacherView({ channel, worksheets, onRefresh }) {
  const [title, setTitle] = useState("");
  const [stepsText, setStepsText] = useState("");
  const [showForm, setShowForm] = useState(false);

  const createWs = useCallback(async () => {
    if (!title.trim()) return;
    const steps = stepsText
      .split("\n")
      .filter(s => s.trim())
      .map(s => ({ title: s.trim(), type: "step" }));
    await channel.createWorksheet(title, steps);
    setTitle("");
    setStepsText("");
    setShowForm(false);
    onRefresh();
  }, [channel, title, stepsText, onRefresh]);

  return (
    <div>
      <Button onClick={() => setShowForm(!showForm)}>
        {showForm ? "Cancel" : "New Worksheet"}
      </Button>
      {showForm && (
        <div className={styles.form}>
          <input
            className={styles.input}
            placeholder="Worksheet title"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
          <textarea
            className={styles.textarea}
            placeholder="One step per line..."
            value={stepsText}
            onChange={e => setStepsText(e.target.value)}
          />
          <Button onClick={createWs} disabled={!title.trim()}>
            Create
          </Button>
        </div>
      )}
      <StudentView channel={channel} worksheets={worksheets} />
    </div>
  );
}

export default function WorksheetPanel({ channel, isTeacher, onClose }) {
  const [worksheets, setWorksheets] = useState([]);

  const load = useCallback(async () => {
    try {
      const res = await channel.fetchWorksheets();
      setWorksheets(res.worksheets || []);
    } catch { /* ignore */ }
  }, [channel]);

  useEffect(() => { load(); }, [load]);

  return (
    <Column>
      <div className={styles.header}>Worksheets</div>
      {isTeacher ? (
        <TeacherView channel={channel} worksheets={worksheets} onRefresh={load} />
      ) : (
        <StudentView channel={channel} worksheets={worksheets} />
      )}
      <Button onClick={onClose}>Close</Button>
    </Column>
  );
}

WorksheetPanel.propTypes = {
  channel: PropTypes.object.isRequired,
  isTeacher: PropTypes.bool,
  onClose: PropTypes.func.isRequired
};

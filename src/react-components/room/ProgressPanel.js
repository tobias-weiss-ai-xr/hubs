import React, { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { FormattedMessage } from "react-intl";
import { Button } from "../input/Button";
import { Column } from "../layout/Column";
import styles from "./ProgressPanel.scss";

const STATUS_BADGE = {
  visited: styles.badgeVisited,
  started: styles.badgeStarted,
  completed: styles.badgeCompleted
};

const STATUS_LABEL = {
  visited: <FormattedMessage id="progress-panel.status.visited" defaultMessage="Visited" />,
  started: <FormattedMessage id="progress-panel.status.started" defaultMessage="In Progress" />,
  completed: <FormattedMessage id="progress-panel.status.completed" defaultMessage="Done" />
};

function formatTime(ms) {
  if (!ms) return "";
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

function StudentProgressEntry({ entry }) {
  return (
    <div className={styles.elementRow}>
      <span className={styles.elementName}>{entry.element_slug}</span>
      <span className={`${styles.badge} ${STATUS_BADGE[entry.status] || ""}`}>
        {STATUS_LABEL[entry.status] || entry.status}
      </span>
      {entry.max_score != null && (
        <span className={styles.score}>
          {entry.score ?? 0}/{entry.max_score}
        </span>
      )}
      <span className={styles.time}>{formatTime(entry.time_spent_ms)}</span>
    </div>
  );
}

StudentProgressEntry.propTypes = {
  entry: PropTypes.shape({
    element_slug: PropTypes.string,
    status: PropTypes.string,
    score: PropTypes.number,
    max_score: PropTypes.number,
    time_spent_ms: PropTypes.number
  }).isRequired
};

function StudentCard({ student, expanded, onToggle }) {
  const entries = student.entries || [];
  const completed = entries.filter(e => e.status === "completed").length;
  const pct = entries.length > 0 ? Math.round((completed / entries.length) * 100) : 0;

  return (
    <div className={styles.studentCard}>
      <div className={styles.studentName}>
        {student.identity_name} — {completed}/{entries.length} ({pct}%)
      </div>
      {expanded && (
        <div className={styles.elementList}>
          {entries.map(e => (
            <StudentProgressEntry key={e.element_slug} entry={e} />
          ))}
        </div>
      )}
      {entries.length > 0 && (
        <button className={styles.toggleBtn} onClick={onToggle}>
          {expanded ? (
            <FormattedMessage id="progress-panel.collapse" defaultMessage="Collapse" />
          ) : (
            <FormattedMessage id="progress-panel.details" defaultMessage="Details" />
          )}
        </button>
      )}
    </div>
  );
}

StudentCard.propTypes = {
  student: PropTypes.shape({
    identity_name: PropTypes.string,
    account_id: PropTypes.string,
    session_id: PropTypes.string,
    entries: PropTypes.array
  }).isRequired,
  expanded: PropTypes.bool,
  onToggle: PropTypes.func.isRequired
};

function TeacherView({ channel }) {
  const [students, setStudents] = useState([]);
  const [expanded, setExpanded] = useState({});

  const load = useCallback(async () => {
    try {
      const res = await channel.getRoomProgress();
      setStudents(res.students || []);
    } catch {
      /* ignore */
    }
  }, [channel]);

  useEffect(() => {
    load();
    channel.onProgressUpdated(load);
  }, [channel, load]);

  const toggle = useCallback(id => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  if (students.length === 0) {
    return (
      <div className={styles.noData}>
        <FormattedMessage id="progress-panel.no-student-activity" defaultMessage="No student activity yet" />
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <FormattedMessage id="progress-panel.room-progress" defaultMessage="Room Progress" />
      </div>
      <div className={styles.studentList}>
        {students.map((s, i) => (
          <StudentCard
            key={s.account_id || s.session_id || i}
            student={s}
            expanded={expanded[s.account_id || s.session_id || i]}
            onToggle={() => toggle(s.account_id || s.session_id || i)}
          />
        ))}
      </div>
      <Button onClick={load}>
        <FormattedMessage id="progress-panel.refresh" defaultMessage="Refresh" />
      </Button>
    </div>
  );
}

TeacherView.propTypes = {
  channel: PropTypes.object.isRequired
};

function StudentView({ channel }) {
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    channel
      .getMyProgress()
      .then(res => setEntries(res.entries || []))
      .catch(() => {});
    channel.onProgressUpdated(() => {
      channel
        .getMyProgress()
        .then(res => setEntries(res.entries || []))
        .catch(() => {});
    });
  }, [channel]);

  const completed = entries.filter(e => e.status === "completed").length;
  const pct = entries.length > 0 ? Math.round((completed / entries.length) * 100) : 0;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <FormattedMessage
          id="progress-panel.my-progress"
          defaultMessage="My Progress — {completed}/{total} ({pct}%)"
          values={{ completed, total: entries.length, pct }}
        />
      </div>
      <div className={styles.elementList}>
        {entries.map(e => (
          <StudentProgressEntry key={e.element_slug} entry={e} />
        ))}
      </div>
      {entries.length === 0 && (
        <div className={styles.noData}>
          <FormattedMessage id="progress-panel.no-progress" defaultMessage="No progress yet" />
        </div>
      )}
    </div>
  );
}

StudentView.propTypes = {
  channel: PropTypes.object.isRequired
};

export default function ProgressPanel({ channel, isTeacher, onClose }) {
  return (
    <Column>
      {isTeacher ? <TeacherView channel={channel} /> : <StudentView channel={channel} />}
      <Button onClick={onClose}>
        <FormattedMessage id="progress-panel.close" defaultMessage="Close" />
      </Button>
    </Column>
  );
}

ProgressPanel.propTypes = {
  channel: PropTypes.object.isRequired,
  isTeacher: PropTypes.bool,
  onClose: PropTypes.func.isRequired
};

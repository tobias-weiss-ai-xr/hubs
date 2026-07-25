import React, { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Button } from "../input/Button";
import { Column } from "../layout/Column";
import styles from "./AnalyticsDashboard.scss";

function StatCard({ value, label }) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statValue}>{value}</div>
      <div className={styles.statLabel}>{label}</div>
    </div>
  );
}

function TeacherView({ channel }) {
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await channel.fetchAnalytics();
      setData(res);
    } catch {}
  }, [channel]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  if (!data) return <div className={styles.noData}>Loading analytics...</div>;

  const { member_count, lobby_count, current_occupants, max_ccu_24h, students = [], quiz_answers = 0 } = data;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>Analytics Dashboard</div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Room</div>
        <div className={styles.statGrid}>
          <StatCard value={member_count ?? current_occupants ?? 0} label="In Room" />
          <StatCard value={lobby_count ?? 0} label="In Lobby" />
          <StatCard value={max_ccu_24h ?? 0} label="Peak (24h)" />
          <StatCard value={students.length} label="Tracked Students" />
        </div>
      </div>

      {students.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Student Activity</div>
          <div className={styles.studentList}>
            {students.slice(0, 20).map((s, i) => (
              <div key={i} className={styles.studentRow}>
                <span className={styles.studentName}>{s.identity_name}</span>
                <span className={styles.studentProgress}>{s.element_count} elements</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {quiz_answers > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Quiz Activity</div>
          <div className={styles.quizCard}>
            <div className={styles.quizQuestion}>Total Answers</div>
            <div className={styles.quizStat}>{quiz_answers} responses</div>
          </div>
        </div>
      )}

      <Button onClick={load}>Refresh</Button>
    </div>
  );
}

function StudentView({ channel }) {
  return (
    <div className={styles.panel}>
      <div className={styles.header}>Your Analytics</div>
      <div className={styles.noData}>Student analytics coming soon.</div>
    </div>
  );
}

export default function AnalyticsDashboard({ channel, isTeacher, onClose }) {
  return (
    <Column>
      {isTeacher ? <TeacherView channel={channel} /> : <StudentView channel={channel} />}
      <Button onClick={onClose}>Close</Button>
    </Column>
  );
}

AnalyticsDashboard.propTypes = {
  channel: PropTypes.object.isRequired,
  isTeacher: PropTypes.bool,
  onClose: PropTypes.func.isRequired
};

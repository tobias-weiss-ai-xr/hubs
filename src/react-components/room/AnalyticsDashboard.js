import React, { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { FormattedMessage } from "react-intl";
import { Button } from "../input/Button";
import { Column } from "../layout/Column";
import styles from "./AnalyticsDashboard.scss";

function formatTime(ms) {
  if (!ms) return "";
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

function RoomStatsCard({ room }) {
  if (!room) return null;

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>
        {room.name || <FormattedMessage id="analytics-dashboard.room-label" defaultMessage="Room" />}
      </div>
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{room.current_occupants ?? "—"}</div>
          <div className={styles.statLabel}>
            <FormattedMessage id="analytics-dashboard.stat.present" defaultMessage="Present" />
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{room.members_in_room ?? "—"}</div>
          <div className={styles.statLabel}>
            <FormattedMessage id="analytics-dashboard.stat.in-room" defaultMessage="In Room" />
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{room.members_in_lobby ?? "—"}</div>
          <div className={styles.statLabel}>
            <FormattedMessage id="analytics-dashboard.stat.in-lobby" defaultMessage="In Lobby" />
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{room.max_ccu_24h ?? "—"}</div>
          <div className={styles.statLabel}>
            <FormattedMessage id="analytics-dashboard.stat.peak-24h" defaultMessage="Peak (24h)" />
          </div>
        </div>
      </div>
    </div>
  );
}

RoomStatsCard.propTypes = {
  room: PropTypes.shape({
    name: PropTypes.string,
    current_occupants: PropTypes.number,
    members_in_room: PropTypes.number,
    members_in_lobby: PropTypes.number,
    max_ccu_24h: PropTypes.number
  })
};

function StudentProgressList({ students }) {
  if (!students || students.length === 0) {
    return (
      <div className={styles.noData}>
        <FormattedMessage id="analytics-dashboard.no-students" defaultMessage="No student activity yet" />
      </div>
    );
  }

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>
        <FormattedMessage
          id="analytics-dashboard.students-header"
          defaultMessage="Students ({count})"
          values={{ count: students.length }}
        />
      </div>
      <div className={styles.studentList}>
        {students.map((s, i) => {
          const pct = s.total_elements > 0 ? Math.round((s.completed / s.total_elements) * 100) : 0;
          return (
            <div key={s.account_id || i} className={styles.studentRow}>
              <span className={styles.studentName}>{s.identity_name}</span>
              <span className={styles.studentStat}>
                {s.completed}/{s.total_elements}
              </span>
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${pct}%` }} />
              </div>
              <span className={styles.studentStat}>{pct}%</span>
              <span className={styles.studentStat}>{formatTime(s.total_time_spent_ms)}</span>
              {s.quiz_avg_score != null && (
                <span className={styles.studentStat}>
                  <FormattedMessage
                    id="analytics-dashboard.quiz-score"
                    defaultMessage="Q: {score}%"
                    values={{ score: s.quiz_avg_score }}
                  />
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

StudentProgressList.propTypes = {
  students: PropTypes.arrayOf(
    PropTypes.shape({
      account_id: PropTypes.string,
      identity_name: PropTypes.string,
      completed: PropTypes.number,
      total_elements: PropTypes.number,
      total_time_spent_ms: PropTypes.number,
      quiz_avg_score: PropTypes.number
    })
  )
};

function QuizSummaryCard({ quizSummary }) {
  if (!quizSummary || quizSummary.total_quizzes === 0) {
    return (
      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          <FormattedMessage id="analytics-dashboard.quizzes-header" defaultMessage="Quizzes" />
        </div>
        <div className={styles.noData}>
          <FormattedMessage id="analytics-dashboard.no-quizzes" defaultMessage="No quizzes yet" />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>
        <FormattedMessage id="analytics-dashboard.quizzes-header" defaultMessage="Quizzes" />
      </div>
      <div className={styles.quizSummary}>
        <div className={styles.quizStat}>
          <div className={styles.quizStatValue}>{quizSummary.total_quizzes}</div>
          <div className={styles.quizStatLabel}>
            <FormattedMessage id="analytics-dashboard.total-label" defaultMessage="Total" />
          </div>
        </div>
        <div className={styles.quizStat}>
          <div className={styles.quizStatValue}>{quizSummary.total_participants}</div>
          <div className={styles.quizStatLabel}>
            <FormattedMessage id="analytics-dashboard.participants-label" defaultMessage="Participants" />
          </div>
        </div>
        <div className={styles.quizStat}>
          <div className={styles.quizStatValue}>
            {quizSummary.average_score != null ? `${quizSummary.average_score}%` : "—"}
          </div>
          <div className={styles.quizStatLabel}>
            <FormattedMessage id="analytics-dashboard.avg-score-label" defaultMessage="Avg Score" />
          </div>
        </div>
      </div>
    </div>
  );
}

QuizSummaryCard.propTypes = {
  quizSummary: PropTypes.shape({
    total_quizzes: PropTypes.number,
    total_participants: PropTypes.number,
    average_score: PropTypes.number
  })
};

export default function AnalyticsDashboard({ channel, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await channel.fetchAnalytics();
      setData(res);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [channel]);

  useEffect(() => {
    load();
    channel.onProgressUpdated(load);
  }, [channel, load]);

  if (loading && !data) {
    return (
      <div className={styles.noData}>
        <FormattedMessage id="analytics-dashboard.loading" defaultMessage="Loading…" />
      </div>
    );
  }

  return (
    <Column>
      <div className={styles.panel}>
        {data ? (
          <>
            <RoomStatsCard room={data.room} />
            <StudentProgressList students={data.students} />
            <QuizSummaryCard quizSummary={data.quiz_summary} />
          </>
        ) : (
          <div className={styles.noData}>
            <FormattedMessage id="analytics-dashboard.error" defaultMessage="Failed to load analytics" />
          </div>
        )}
        <Button onClick={load}>
          <FormattedMessage id="analytics-dashboard.refresh" defaultMessage="Refresh" />
        </Button>
      </div>
      <Button onClick={onClose}>
        <FormattedMessage id="analytics-dashboard.close" defaultMessage="Close" />
      </Button>
    </Column>
  );
}

AnalyticsDashboard.propTypes = {
  channel: PropTypes.object.isRequired,
  onClose: PropTypes.func.isRequired
};

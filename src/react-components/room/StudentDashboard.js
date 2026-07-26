import React, { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { FormattedMessage } from "react-intl";
import styles from "./StudentDashboard.scss";

export default function StudentDashboard({ channel }) {
  const [myProgress, setMyProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const progress = await channel.getMyProgress();
      setMyProgress(progress);
    } catch (e) {
      setError(e.message || "Failed to load progress");
    } finally {
      setLoading(false);
    }
  }, [channel]);

  useEffect(() => {
    loadData();
    const detach = channel.onProgressUpdated(loadData);
    return () => {
      if (typeof detach === "function") {
        detach();
      }
    };
  }, [loadData, channel]);

  const entries = myProgress?.entries || [];
  const completed = entries.filter(e => e.status === "completed").length;
  const total = entries.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className={styles.dashboard}>
      <div className={styles.header}>
        <FormattedMessage id="student-dashboard.title" defaultMessage="My Learning Progress" />
      </div>

      {loading && entries.length === 0 && !error && (
        <div className={styles.loading} role="status">
          <FormattedMessage id="student-dashboard.loading" defaultMessage="Loading progress..." />
        </div>
      )}

      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}

      {!loading && entries.length === 0 && !error && (
        <div className={styles.empty}>
          <FormattedMessage
            id="student-dashboard.empty"
            defaultMessage="No progress yet. Explore the room to start tracking your progress!"
          />
        </div>
      )}

      {entries.length > 0 && (
        <>
          <div className={styles.summary}>
            <div className={styles.summaryCard}>
              <div className={styles.summaryValue}>{completed}</div>
              <div className={styles.summaryLabel}>
                <FormattedMessage id="student-dashboard.completed" defaultMessage="Completed" />
              </div>
            </div>
            <div className={styles.summaryCard}>
              <div className={styles.summaryValue}>{total}</div>
              <div className={styles.summaryLabel}>
                <FormattedMessage id="student-dashboard.total" defaultMessage="Total Elements" />
              </div>
            </div>
            <div className={styles.summaryCard}>
              <div className={styles.summaryValue}>{pct}%</div>
              <div className={styles.summaryLabel}>
                <FormattedMessage id="student-dashboard.progress" defaultMessage="Progress" />
              </div>
            </div>
          </div>

          <div
            className={styles.progressBar}
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className={styles.progressFill} style={{ width: `${pct}%` }} />
          </div>

          <div className={styles.elementList}>
            <div className={styles.sectionTitle}>
              <FormattedMessage id="student-dashboard.elements" defaultMessage="Elements" />
            </div>
            {entries.map(entry => (
              <div key={entry.element_slug} className={styles.elementRow}>
                <span className={styles.elementName}>{entry.element_slug}</span>
                <span className={`${styles.badge} ${styles[`badge_${entry.status}`] || ""}`}>
                  {entry.status === "completed" && "✓"}
                  {entry.status === "started" && "◉"}
                  {entry.status === "visited" && "○"} {entry.status}
                </span>
                {entry.score != null && (
                  <span className={styles.score}>
                    <FormattedMessage
                      id="student-dashboard.score"
                      defaultMessage="{score}/{max}"
                      values={{ score: entry.score, max: entry.max_score || "—" }}
                    />
                  </span>
                )}
                {entry.time_spent_ms > 0 && (
                  <span className={styles.time}>
                    <FormattedMessage
                      id="student-dashboard.time-seconds"
                      defaultMessage="{time}s"
                      values={{ time: Math.floor(entry.time_spent_ms / 1000) }}
                    />
                  </span>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <button className={styles.refresh} onClick={loadData} disabled={loading}>
        <FormattedMessage id="student-dashboard.refresh" defaultMessage="↻ Refresh" />
      </button>
    </div>
  );
}

StudentDashboard.propTypes = {
  channel: PropTypes.shape({
    getMyProgress: PropTypes.func.isRequired,
    onProgressUpdated: PropTypes.func.isRequired
  }).isRequired
};

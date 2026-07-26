import React, { useState, useCallback, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { FormattedMessage } from "react-intl";
import { Button } from "../input/Button";
import { Column } from "../layout/Column";
import styles from "./TokenGenerationPanel.scss";

function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(() => {
      // Fallback: select-less copy ignored silently
    });
  }
}

export default function TokenGenerationPanel({ channel, onClose }) {
  const [tokens, setTokens] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [error, setError] = useState(null);
  const copiedTimerRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (copiedTimerRef.current) {
        clearTimeout(copiedTimerRef.current);
      }
    };
  }, []);

  const loadSessions = useCallback(async () => {
    try {
      const hubId = channel.hubId;
      const resp = await fetch(`/api/v1/hubs/${hubId}/sessions`, {
        headers: channel.store.state.credentials.token
          ? { authorization: `bearer ${channel.store.state.credentials.token}` }
          : {}
      });
      if (resp.ok) {
        const data = await resp.json();
        setTokens(data.sessions || []);
      }
    } catch {
      // Not critical if this fails
    }
  }, [channel]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const flashCopied = useCallback(index => {
    setCopiedIndex(index);
    copiedTimerRef.current = setTimeout(() => {
      if (mountedRef.current) {
        setCopiedIndex(null);
      }
    }, 3000);
  }, []);

  const generateToken = useCallback(
    async (role = "student") => {
      setGenerating(true);
      setError(null);
      try {
        const hubId = channel.hubId;
        const resp = await fetch("/api/v1/rooms/token", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(channel.store.state.credentials.token
              ? { authorization: `bearer ${channel.store.state.credentials.token}` }
              : {})
          },
          body: JSON.stringify({ room_id: hubId, role })
        });

        if (resp.ok) {
          const data = await resp.json();
          const newToken = {
            id: `token-${Date.now()}`,
            access_token: data.access_token,
            role: data.role,
            created_at: new Date().toISOString()
          };
          setTokens(prev => [newToken, ...prev]);
          copyToClipboard(data.access_token);
          flashCopied(0);
        } else {
          const err = await resp.json().catch(() => ({ error: "Failed to generate token" }));
          setError(err.error || "Failed to generate token");
        }
      } catch (e) {
        setError(e.message || "Network error");
      } finally {
        setGenerating(false);
      }
    },
    [channel, flashCopied]
  );

  const copyToken = useCallback(
    (token, index) => {
      copyToClipboard(token);
      flashCopied(index);
    },
    [flashCopied]
  );

  return (
    <Column grow>
      <div className={styles.panel}>
        <div className={styles.header}>
          <FormattedMessage id="token-generation.title" defaultMessage="Access Tokens" />
        </div>

        {error && (
          <div className={styles.error} role="alert">
            {error}
          </div>
        )}

        <div className={styles.actions}>
          <Button onClick={() => generateToken("student")} disabled={generating}>
            {generating ? (
              <FormattedMessage id="token-generation.generating" defaultMessage="Generating…" />
            ) : (
              <FormattedMessage id="token-generation.generate-student" defaultMessage="Generate Student Token" />
            )}
          </Button>
          <Button onClick={() => generateToken("teacher")} disabled={generating}>
            <FormattedMessage id="token-generation.generate-teacher" defaultMessage="Generate Teacher Token" />
          </Button>
        </div>

        <div className={styles.hint}>
          <FormattedMessage
            id="token-generation.hint"
            defaultMessage="Tokens are auto-copied to clipboard. Share them with students so they can join this room."
          />
        </div>

        {tokens.length > 0 && (
          <div className={styles.tokenList}>
            <div className={styles.subheader}>
              <FormattedMessage
                id="token-generation.recent-tokens"
                defaultMessage="Recent Tokens ({count})"
                values={{ count: tokens.length }}
              />
            </div>
            {tokens.map((token, i) => (
              <div key={token.id || i} className={styles.tokenRow}>
                <div className={styles.tokenInfo}>
                  <span className={styles.tokenRole}>
                    {token.role === "teacher" ? "👤" : "🎓"} {token.role}
                  </span>
                  <span className={styles.tokenDate}>
                    {token.created_at ? new Date(token.created_at).toLocaleString() : ""}
                  </span>
                </div>
                <button
                  className={styles.copyBtn}
                  onClick={() => copyToken(token.access_token, i)}
                  aria-label={`${token.role} token`}
                >
                  {copiedIndex === i ? (
                    <FormattedMessage id="token-generation.copied" defaultMessage="✓ Copied" />
                  ) : (
                    <FormattedMessage id="token-generation.copy" defaultMessage="Copy" />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}

        {tokens.length === 0 && !generating && (
          <div className={styles.empty}>
            <FormattedMessage
              id="token-generation.empty"
              defaultMessage="No tokens generated yet. Generate a token to share with students."
            />
          </div>
        )}
      </div>
      <Button onClick={onClose}>
        <FormattedMessage id="token-generation.close" defaultMessage="Close" />
      </Button>
    </Column>
  );
}

TokenGenerationPanel.propTypes = {
  channel: PropTypes.shape({
    hubId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    store: PropTypes.shape({
      state: PropTypes.shape({
        credentials: PropTypes.shape({
          token: PropTypes.string
        })
      })
    })
  }).isRequired,
  onClose: PropTypes.func.isRequired
};

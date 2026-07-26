import React, { useState, useCallback } from "react";
import PropTypes from "prop-types";
import { FormattedMessage } from "react-intl";
import classNames from "classnames";
import { Modal } from "../modal/Modal";
import { Button } from "../input/Button";
import { TextInput } from "../input/TextInput";
import { InputField } from "../input/InputField";
import { Column } from "../layout/Column";
import { AppLogo } from "../misc/AppLogo";
import { useCssBreakpoints } from "react-use-css-breakpoints";
import styles from "./RoomAccessTokenEntryModal.scss";

export function RoomAccessTokenEntryModal({ className, roomName, onSubmit, onCancel, error, ...rest }) {
  const breakpoint = useCssBreakpoints();
  const [token, setToken] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(
    async e => {
      e.preventDefault();
      if (!token.trim() || submitting) return;
      setSubmitting(true);
      try {
        await onSubmit(token.trim());
      } finally {
        setSubmitting(false);
      }
    },
    [token, submitting, onSubmit]
  );

  return (
    <Modal className={classNames(styles.roomAccessTokenEntryModal, className)} disableFullscreen {...rest}>
      <Column center className={styles.content}>
        {breakpoint !== "sm" && breakpoint !== "md" && <AppLogo className={styles.logo} />}
        <div className={styles.roomName}>
          <h5>
            <FormattedMessage id="room-access-token-entry-modal.room-name-label" defaultMessage="Room Name" />
          </h5>
          <p>{roomName}</p>
        </div>
        <form onSubmit={handleSubmit} className={styles.form}>
          <InputField
            htmlFor="room-access-token-input"
            label={
              <FormattedMessage id="room-access-token-entry-modal.token-label" defaultMessage="Room Access Token" />
            }
            error={error}
            className={styles.tokenField}
          >
            <TextInput
              id="room-access-token-input"
              className={styles.tokenInput}
              placeholder="Paste your room access token here"
              value={token}
              onChange={e => setToken(e.target.value)}
              disabled={submitting}
              invalid={!!error}
              autoFocus
            />
          </InputField>
          <Button preset="accent4" type="submit" disabled={!token.trim() || submitting}>
            {submitting ? "Joining..." : "Join Room"}
          </Button>
          {onCancel && (
            <Button preset="transparent" onClick={onCancel} disabled={submitting}>
              <FormattedMessage id="room-access-token-entry-modal.cancel-button" defaultMessage="Cancel" />
            </Button>
          )}
        </form>
      </Column>
    </Modal>
  );
}

RoomAccessTokenEntryModal.propTypes = {
  className: PropTypes.string,
  roomName: PropTypes.string.isRequired,
  onSubmit: PropTypes.func.isRequired,
  onCancel: PropTypes.func,
  error: PropTypes.string
};

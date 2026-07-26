import React, { useState, useCallback, useRef } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { Button } from "../input/Button";
import ElementSelector from "../room/ElementSelector";
import styles from "./ChemistryCreateRoomButton.scss";

export function ChemistryCreateRoomButton() {
  const intl = useIntl();
  const [showSelector, setShowSelector] = useState(false);
  const [creating, setCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const overlayRef = useRef(null);

  const handleClose = useCallback(async symbol => {
    if (!symbol) {
      setShowSelector(false);
      return;
    }

    setCreating(true);

    try {
      const token = window.APP?.store?.state?.credentials?.token;
      const headers = { "content-type": "application/json" };
      if (token) {
        headers.authorization = `bearer ${token}`;
      }

      const resp = await fetch("/api/v1/rooms/classroom", {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: `${symbol} Chemieraum`,
          user_data: { chemistry: { symbol } }
        })
      });

      if (resp.ok) {
        const data = await resp.json();
        window.location.href = data.url || `/hub.html?hub_id=${data.room_id}`;
      } else {
        const err = await resp.json().catch(() => ({ error: "Fehler beim Erstellen des Raums" }));
        setErrorMessage(err.error || "Fehler beim Erstellen des Raums");
        setCreating(false);
        setShowSelector(false);
      }
    } catch (e) {
      setErrorMessage(e.message || "Netzwerkfehler");
      setCreating(false);
      setShowSelector(false);
    }
  }, []);

  const handleOpen = useCallback(() => {
    setErrorMessage(null);
    setShowSelector(true);
  }, []);

  return (
    <>
      <Button thick preset="landing" onClick={handleOpen} disabled={creating} className={styles.chemBtn}>
        {creating ? (
          <FormattedMessage id="create-chemistry-room.creating" defaultMessage="Erstellen…" />
        ) : (
          <FormattedMessage id="create-chemistry-room.button" defaultMessage="🧪 Chemieraum" />
        )}
      </Button>

      {errorMessage && (
        <div className={styles.errorBanner} role="alert">
          {errorMessage}
          <button className={styles.errorClose} onClick={() => setErrorMessage(null)}>
            ×
          </button>
        </div>
      )}

      {showSelector && (
        <div
          className={styles.overlay}
          ref={overlayRef}
          onClick={e => {
            if (e.target === overlayRef.current) {
              setShowSelector(false);
            }
          }}
          role="dialog"
          aria-modal="true"
          aria-label={intl.formatMessage({ id: "element-selector.overlay-label", defaultMessage: "Element Selector" })}
        >
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <ElementSelector onClose={handleClose} />
          </div>
        </div>
      )}
    </>
  );
}

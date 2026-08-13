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

      // Use the auth_optional /api/v1/hubs endpoint (same as the standard
      // "Create Room" flow) so guests can create chemistry rooms without
      // signing in. user_data.chemistry is validated server-side.
      const payload = {
        hub: {
          name: `${symbol} Chemieraum`,
          user_data: { chemistry: { symbol } }
        }
      };

      let resp = await fetch("/api/v1/hubs", {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      });

      let data = await resp.json().catch(() => ({}));

      // Retry anonymously if the stored token was invalid.
      if (!resp.ok && data.error === "invalid_token") {
        delete headers.authorization;
        resp = await fetch("/api/v1/hubs", {
          method: "POST",
          headers,
          body: JSON.stringify(payload)
        });
        data = await resp.json().catch(() => ({}));
      }

      if (resp.ok && data.hub_id) {
        window.location.href = data.url || `/hub.html?hub_id=${data.hub_id}`;
      } else {
        const errMsg = data.error || data.details || "Fehler beim Erstellen des Raums";
        setErrorMessage(errMsg);
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

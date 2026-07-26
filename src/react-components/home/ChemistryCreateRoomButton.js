import React, { useState, useCallback } from "react";
import { FormattedMessage } from "react-intl";
import { Button } from "../input/Button";
import ElementSelector from "./ElementSelector";
import styles from "./ChemistryCreateRoomButton.scss";

export function ChemistryCreateRoomButton() {
  const [showSelector, setShowSelector] = useState(false);
  const [creating, setCreating] = useState(false);

  const handleSelectElement = useCallback(async symbol => {
    if (!symbol) {
      setShowSelector(false);
      return;
    }

    setCreating(true);

    try {
      const name = `${symbol} Chemieraum`;
      const resp = await fetch("/api/v1/rooms/classroom", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(window.APP?.store?.state?.credentials?.token
            ? { authorization: `bearer ${window.APP.store.state.credentials.token}` }
            : {})
        },
        body: JSON.stringify({
          name,
          user_data: {
            chemistry: {
              symbol
            }
          }
        })
      });

      if (resp.ok) {
        const data = await resp.json();
        // Redirect to the created room
        if (data.url) {
          window.location.href = data.url;
        } else {
          window.location.href = `/hub.html?hub_id=${data.room_id}`;
        }
      } else {
        const err = await resp.json().catch(() => ({ error: "Failed to create room" }));
        alert(err.error || "Failed to create chemistry room");
        setCreating(false);
        setShowSelector(false);
      }
    } catch (e) {
      alert(e.message || "Network error");
      setCreating(false);
      setShowSelector(false);
    }
  }, []);

  return (
    <>
      <Button
        thick
        preset="landing"
        onClick={() => setShowSelector(true)}
        disabled={creating}
        className={styles.chemBtn}
      >
        {creating ? (
          <FormattedMessage id="create-chemistry-room.creating" defaultMessage="Creating…" />
        ) : (
          <FormattedMessage id="create-chemistry-room.button" defaultMessage="🧪 Chemistry Room" />
        )}
      </Button>

      {showSelector && (
        <div className={styles.overlay} onClick={() => setShowSelector(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <ElementSelector
              selectedSymbol={null}
              onSelect={el => handleSelectElement(el.symbol)}
              onClose={() => setShowSelector(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}

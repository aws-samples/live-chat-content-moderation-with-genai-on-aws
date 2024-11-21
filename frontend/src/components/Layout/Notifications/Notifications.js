import React from "react";
import { useTranslation } from "react-i18next";
import styles from "./Notifications.module.css";

function Notifications({ isOpen, onClose, notifications }) {
  const { t } = useTranslation();
  if (!isOpen) return null;

  return (
    <div className={styles.notificationsPanel}>
      <div className={styles.notificationsHeader}>
        <strong>{t("NOTIFICATIONS.TEXT.TITLE")}</strong>
        <button
          onClick={onClose}
          className={styles.closeButton}
          aria-label={t("NOTIFICATIONS.ACTIONS.CLOSE")}
        >
          ×
        </button>
      </div>
      <div className={styles.notificationsList}>
        {notifications.length === 0 ? (
          <p>{t("NOTIFICATIONS.STATUS.EMPTY")}</p>
        ) : (
          notifications.map((notification, index) => (
            <div key={index} className={styles.notificationItem}>
              <p>{notification.message}</p>
              <small>{new Date(notification.timestamp).toLocaleString()}</small>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default Notifications;

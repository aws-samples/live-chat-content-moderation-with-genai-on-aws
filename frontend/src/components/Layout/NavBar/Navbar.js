import React, { useState } from "react";
import { FaRegBell } from "react-icons/fa6";
import { useTranslation } from "react-i18next";
import Notifications from "../Notifications/Notifications";
import styles from "./Navbar.module.css";

function Navbar({ notifications }) {
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const { t } = useTranslation();

  return (
    <nav
      className={`navbar navbar-light ${styles.customPadding} ${styles.navBarColor}`}
    >
      <div className={`container-fluid ${styles.navbarContainer}`}>
        <div className={styles.navbarTitleContainer}>
          <span className={styles.navbarTitle}>
            <strong>{t("NAVBAR.TEXT.TITLE")}</strong>
          </span>
        </div>
        <button
          onClick={() => setIsNotificationsOpen(true)}
          className={styles.notificationsButton}
          aria-label={t("NAVBAR.ACTIONS.OPEN_NOTIFICATIONS")}
        >
          <FaRegBell />
        </button>
      </div>
      <Notifications
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
      />
    </nav>
  );
}

export default Navbar;

import React, { useState } from "react";
import axios from "axios";
import { REST_API_ENDPOINT } from "../../../config/config";
import { ulid } from "ulid";
import { FaPaperPlane } from "react-icons/fa";
import styles from "./MessageInput.module.css";

function MessageInput({ userId, userName }) {
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (message.trim() === "" || !userId || !userName) {
      return;
    }

    const messageId = ulid();
    const timestamp = new Date().toISOString();

    const messageData = {
      message: {
        messageId,
        userId,
        userName,
        userMessage: message,
        timestamp,
      },
    };

    try {
      await axios.post(REST_API_ENDPOINT, messageData);
      setMessage("");
    } catch (error) {
      console.error("[ERROR] Error sending message:", error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.messageInputForm}>
      <div className="input-group">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Send a message"
          className={`form-control ${styles.messageInput}`}
        />
        <button
          type="submit"
          className={`btn btn-primary ${styles.sendButton}`}
        >
          <FaPaperPlane />
        </button>
      </div>
    </form>
  );
}

export default MessageInput;

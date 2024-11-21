import React, { useEffect, useRef } from "react";
import moment from "moment";
import styles from "./MessageDisplay.module.css";

function MessageDisplay({ messages, currentUserId }) {
  const messageListRef = useRef(null);

  useEffect(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className={styles.messageList} ref={messageListRef}>
      {messages.map((item) => (
        <MessageItem
          key={item.messageId}
          message={item}
          isCurrentUser={item.userId === currentUserId}
        />
      ))}
    </div>
  );
}

function MessageItem({ message, isCurrentUser }) {
  return (
    <div
      className={`${styles.messageItem} ${
        isCurrentUser ? styles.userMessage : ""
      }`}
    >
      <div className={styles.messageContent}>
        <strong>{message.userName}:</strong> {message.userMessage}
      </div>
      <div className={styles.messageTimestamp}>
        {moment(message.timestamp).format("h:mm A")}
      </div>
    </div>
  );
}

export default MessageDisplay;

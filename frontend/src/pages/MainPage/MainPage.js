import React, { useState, useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import { faker } from "@faker-js/faker";
import { ToastContainer, toast } from "react-toastify";
import { FaExclamationTriangle, FaAws } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import "react-toastify/dist/ReactToastify.css";
import MessageInput from "../../components/Chat/MessageInput/MessageInput";
import MessageDisplay from "../../components/Chat/MessageDisplay/MessageDisplay";
import VideoPlayer from "../../components/Video/VideoPlayer/VideoPlayer";
import Navbar from "../../components/Layout/Navbar/Navbar";
import {
  GRAPHQL_API_ENDPOINT,
  GRAPHQL_REAL_TIME_API_ENDPOINT,
  APPSYNC_API_KEY,
} from "../../config/config";
import styles from "./MainPage.module.css";

function MainPage() {
  const [messages, setMessages] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [userId, setUserId] = useState(null);
  const [userName, setUserName] = useState(null);
  const socketRef = useRef(null);
  const { t } = useTranslation();

  const moderationGuidelines = `Our chat is automatically moderated to ensure a safe and respectful environment. Messages may be blocked if they contain:

    1. Hate speech or discrimination
    2. Explicit threats of violence
    3. Severe profanity
    4. Bullying or harassment
    5. Spam or excessive self-promotion
    6. Selling or advertising products
    7. Sharing personal information
    8. Encouraging self-harm or illegal activities
    
    Please keep the conversation friendly and inclusive. Thank you for your cooperation!
  `;

  useEffect(() => {
    // Generate a unique userId if not already set
    const newUserId = localStorage.getItem("userId") || uuidv4();
    setUserId(newUserId);
    localStorage.setItem("userId", newUserId);

    // Generate or retrieve the full name
    let fullName = localStorage.getItem("userName");
    if (!fullName) {
      fullName = faker.person.fullName();
      localStorage.setItem("userName", fullName);
    }
    setUserName(fullName);

    // Load notifications from localStorage
    const storedNotifications = JSON.parse(
      localStorage.getItem("notifications") || "[]"
    );
    setNotifications(storedNotifications);

    // Set up AppSync WebSocket connection
    const header = {
      host: GRAPHQL_API_ENDPOINT.replace("https://", "").replace(
        "/graphql",
        ""
      ),
      "x-api-key": APPSYNC_API_KEY,
    };

    const encodedHeader = btoa(JSON.stringify(header));
    const urlEncodedHeader = encodeURIComponent(encodedHeader);
    const wsUrl = `${GRAPHQL_REAL_TIME_API_ENDPOINT}?header=${urlEncodedHeader}&payload=e30=`;

    socketRef.current = new WebSocket(wsUrl, ["graphql-ws"]);

    socketRef.current.onopen = function (e) {
      console.log("Connection established.");
      const connectionInit = {
        type: "connection_init",
      };
      socketRef.current.send(JSON.stringify(connectionInit));
    };

    socketRef.current.onmessage = function (event) {
      const data = JSON.parse(event.data);

      if (data.type === "connection_ack") {
        console.log("Connection acknowledged.");

        // Register subscriptions after connection_ack
        registerSubscription(
          "messagesSub",
          `subscription OnBroadcastMessage {
            onBroadcastMessage {
              messageId
              userId
              userName
              userMessage
              timestamp
              bedrockResponse
              modelId
            }
          }`
        );

        registerSubscription(
          "notificationsSub",
          `subscription OnReceiveNotification($userId: ID!) {
            onReceiveNotification(userId: $userId) {
              userId
              userMessage
            }
          }`,
          { userId: newUserId }
        );
      }

      if (data.type === "start_ack") {
        console.log(`Subscription acknowledged: ${data.id}`);
      }

      if (data.type === "data") {
        if (data.id === "messagesSub") {
          const newMessage = data.payload.data.onBroadcastMessage;
          setMessages((prevMessages) => [...prevMessages, newMessage]);
          console.log(
            `Message from: ${newMessage.userName}\n` +
              `Message: ${newMessage.userMessage}\n` +
              `Timestamp: ${newMessage.timestamp}\n` +
              `Model used: ${newMessage.modelId || "Not specified"}`
          );
        } else if (data.id === "notificationsSub") {
          const newNotification = data.payload.data.onReceiveNotification;
          handleNewNotification(newNotification);
        }
      }
    };

    socketRef.current.onclose = function (event) {
      if (event.wasClean) {
        console.log("Connection closed cleanly.");
      } else {
        console.log("Connection died.");
      }
    };

    socketRef.current.onerror = function (error) {
      console.log(`[ERROR]`, error);
    };

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

  const registerSubscription = (id, query, variables = null) => {
    const subscriptionMessage = {
      id: id,
      type: "start",
      payload: {
        data: JSON.stringify({
          query: query,
          variables: variables,
        }),
        extensions: {
          authorization: {
            "x-api-key": APPSYNC_API_KEY,
          },
        },
      },
    };
    socketRef.current.send(JSON.stringify(subscriptionMessage));
    console.log(`Subscription registration sent: ${id}`);
  };

  const handleNewNotification = (newNotification) => {
    const notificationMessage = `Your message "${newNotification.userMessage}" has been flagged for review. To maintain a positive environment, we ask that all content adheres to our community guidelines.`;

    toast.warn(notificationMessage, {
      position: "top-right",
      autoClose: 15000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      progress: undefined,
      className: styles.customToast,
      bodyClassName: styles.customToastBody,
      icon: <FaExclamationTriangle color="#8D6E63" />,
    });

    const updatedNotification = {
      message: notificationMessage,
      timestamp: new Date().toISOString(),
    };

    setNotifications((prevNotifications) => {
      const updatedNotifications = [updatedNotification, ...prevNotifications];
      localStorage.setItem(
        "notifications",
        JSON.stringify(updatedNotifications)
      );
      return updatedNotifications;
    });
  };

  return (
    <div className={styles.app}>
      <Navbar notifications={notifications} />
      <div className={styles.contentWrapper}>
        <div className={styles.videoPlayerWrapper}>
          <div className={styles.liveBadge}>{t("MAIN_PAGE.BADGES.LIVE")}</div>
          <VideoPlayer />
          <p className={styles.guidelineText}>{moderationGuidelines}</p>
        </div>
        <div className={styles.chatWrapper}>
          <MessageDisplay messages={messages} currentUserId={userId} />
          <MessageInput userId={userId} userName={userName} />
        </div>
      </div>
      <ToastContainer
        position="top-right"
        autoClose={30000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        toastClassName={styles.customToast}
        bodyClassName={styles.customToastBody}
      />
    </div>
  );
}

export default MainPage;

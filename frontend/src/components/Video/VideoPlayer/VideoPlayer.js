import React from "react";
import styles from "./VideoPlayer.module.css";

function VideoPlayer() {
  return (
    <div className={styles.videoPlayerWrapper}>
      <div className={styles.videoContainer}>
        <video
          className={styles.videoPlayer}
          autoPlay
          muted
          loop
          playsInline
          controls
        >
          <source src="/BigBuckBunny_320x180.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      </div>
    </div>
  );
}

export default VideoPlayer;

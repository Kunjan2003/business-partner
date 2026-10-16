import React from "react";
import { View, Text } from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import { colors } from "../ui";

export default function VideoAttachment({ uid }: { uid: string }) {
  const url = `https://videodelivery.net/${uid}/manifest/video.m3u8`;
  const player = useVideoPlayer(url, (video) => {
    video.loop = true;
  });
  return (
    <View style={{ backgroundColor: "#141414", alignItems: "center" }}>
      <VideoView
        player={player}
        style={{ width: "100%", aspectRatio: 9 / 16, maxHeight: 610 }}
        contentFit="contain"
        nativeControls
      />
      <Text style={{ color: "#cfcfcf", padding: 9, fontSize: 11 }}>
        Video may take a moment to finish processing.
      </Text>
    </View>
  );
}

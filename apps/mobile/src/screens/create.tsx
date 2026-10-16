import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useQuery } from "@tanstack/react-query";
import { useApp, pickPhoto, type Photo as PickedPhoto } from "../session";
import {
  styles as s,
  Button,
  Avatar,
  Photo,
  Icon,
  Chips,
  QueryState,
  Empty,
  colors,
} from "../ui";
import type { Navigate } from "../navigation";
export default function Create({
  navigate,
  published,
}: {
  navigate: Navigate;
  published: () => void;
}) {
  const { api, user, run } = useApp();
  const [photo, setPhoto] = useState<PickedPhoto | null>(null),
    [video, setVideo] = useState<ImagePicker.ImagePickerAsset | null>(null),
    [caption, setCaption] = useState(""),
    [kind, setKind] = useState("Photo / update"),
    [busy, setBusy] = useState(false),
    [picking, setPicking] = useState(false);
  const business = useQuery({
    queryKey: ["my-business", user?.id],
    queryFn: () => api.myBusiness(),
    enabled: user?.role === "owner",
  });
  if (user?.role !== "owner")
    return (
      <Empty
        title="Share your business with the world"
        message="Switch to a business account to publish photos, products and offers."
        icon="add-circle-outline"
        action={{
          label: "Switch account type",
          onPress: () => navigate({ name: "edit-profile" }),
        }}
      />
    );
  if (business.isLoading || business.error)
    return (
      <QueryState
        loading={business.isLoading}
        error={business.error}
        retry={() => void business.refetch()}
      />
    );
  if (!business.data)
    return (
      <Empty
        title="Introduce your business"
        message="Create your business profile first. Then share your products and latest updates."
        icon="storefront-outline"
        action={{
          label: "Set up business",
          onPress: () => navigate({ name: "edit-business" }),
        }}
      />
    );
  const b = business.data;
  return (
    <ScrollView keyboardShouldPersistTaps="handled">
      <View style={s.listRow}>
        <Avatar name={b.name} uri={b.logo_url} />
        <Text style={s.bold}>{b.name}</Text>
      </View>
      <Pressable
        disabled={busy || picking}
        onPress={() => {
          setPicking(true);
          void run(async () => {
            const selected = await pickPhoto();
            if (selected) {
              setPhoto(selected);
              setVideo(null);
            }
          }, []).finally(() => setPicking(false));
        }}
      >
        {photo ? (
          <Photo uri={photo.uri} />
        ) : (
          <View
            style={{
              aspectRatio: 1.2,
              backgroundColor: colors.soft,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Icon name="images-outline" size={48} color="#b2b2bd" />
            <Text style={{ fontSize: 16, fontWeight: "600", marginTop: 14 }}>
              Choose a photo
            </Text>
            <Text style={[s.caption, { marginTop: 5 }]}>
              {picking
                ? "Preparing your photo…"
                : "Tap to select from your gallery"}
            </Text>
          </View>
        )}
      </Pressable>
      <Pressable
        disabled={busy || picking}
        accessibilityRole="button"
        accessibilityLabel="Choose a short video"
        onPress={() => {
          setPicking(true);
          void run(async () => {
            const permission =
              await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permission.granted)
              throw new Error("Please allow video access.");
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ["videos"],
              quality: 1,
            });
            if (!result.canceled) {
              const asset = result.assets[0];
              if ((asset.fileSize ?? 0) > 200 * 1024 * 1024)
                throw new Error("Videos must be under 200 MB.");
              if (asset.duration && asset.duration > 90000)
                throw new Error("Choose a video shorter than 90 seconds.");
              setVideo(asset);
              setPhoto(null);
              setKind("Video reel");
            }
          }, []).finally(() => setPicking(false));
        }}
        style={{
          marginHorizontal: 18,
          marginTop: 13,
          padding: 16,
          borderRadius: 11,
          borderWidth: 1,
          borderColor: colors.line,
          alignItems: "center",
        }}
      >
        <Text style={{ fontWeight: "700", color: colors.ink }}>
          {video
            ? "Video selected: " + (video.fileName ?? "short video")
            : "Choose short video / Reel"}
        </Text>
        <Text style={[s.caption, { marginTop: 5 }]}>
          Up to 90 seconds · Maximum 200 MB
        </Text>
      </Pressable>
      <View style={{ padding: 18 }}>
        {photo && (
          <Button
            title="Change photo"
            outline
            disabled={busy || picking}
            onPress={() => {
              setPicking(true);
              void run(async () => {
                const selected = await pickPhoto();
                if (selected) setPhoto(selected);
              }, []).finally(() => setPicking(false));
            }}
          />
        )}
        <TextInput
          accessibilityLabel="Post caption"
          value={caption}
          onChangeText={setCaption}
          placeholder="Write a caption… Share what’s new, an offer, or the story behind your business."
          multiline
          maxLength={2200}
          style={{
            fontSize: 15,
            lineHeight: 22,
            minHeight: 125,
            textAlignVertical: "top",
            paddingVertical: 16,
          }}
        />
        <Text style={[s.caption, { textAlign: "right" }]}>
          {caption.length}/2200
        </Text>
        <View style={s.divider} />
        <Chips
          values={[
            "Photo / update",
            "Offer",
            "Product highlight",
            "Video reel",
          ]}
          value={kind}
          onChange={setKind}
        />
        <Text style={[s.caption, { marginVertical: 13 }]}>
          Your post will appear in the discovery feed and your business profile.
        </Text>
        <Button
          title="Share post"
          busy={busy}
          disabled={!caption.trim() || picking}
          onPress={() => {
            if (busy) return;
            setBusy(true);
            void run(async () => {
              const image_url =
                !video && photo
                  ? await api.uploadImage(photo.bytes, photo.mime)
                  : "";
              const video_uid = video
                ? await api.uploadVideo(b.id, {
                    uri: video.uri,
                    name: video.fileName ?? "reel.mp4",
                    type: video.mimeType ?? "video/mp4",
                  })
                : undefined;
              await api.createPost({
                business_id: b.id,
                caption,
                image_url,
                video_uid,
                kind: video_uid
                  ? "video"
                  : kind === "Offer"
                    ? "offer"
                    : kind === "Product highlight"
                      ? "product"
                      : "post",
              });
            }, ["feed", "posts", "stats"]).then((ok) => {
              setBusy(false);
              if (ok) {
                setCaption("");
                setPhoto(null);
                setVideo(null);
                setKind("Photo / update");
                published();
              }
            });
          }}
        />
      </View>
    </ScrollView>
  );
}

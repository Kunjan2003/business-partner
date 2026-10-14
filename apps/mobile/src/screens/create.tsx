import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput } from "react-native";
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
            if (selected) setPhoto(selected);
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
          values={["Photo / update", "Offer", "Product highlight"]}
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
              const image_url = photo
                ? await api.uploadImage(photo.bytes, photo.mime)
                : "";
              await api.createPost({
                business_id: b.id,
                caption,
                image_url,
                kind:
                  kind === "Offer"
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
                published();
              }
            });
          }}
        />
      </View>
    </ScrollView>
  );
}

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  Modal,
} from "react-native";
import { useInfiniteQuery } from "@tanstack/react-query";
import * as Location from "expo-location";
import { categories, type SearchInput } from "@bp/core";
import { useApp } from "../session";
import {
  styles as s,
  Icon,
  IconButton,
  Photo,
  Chips,
  QueryState,
  Empty,
  Button,
  Field,
  colors,
} from "../ui";
import type { Navigate } from "../navigation";
export default function Explore({ navigate }: { navigate: Navigate }) {
  const { api, run } = useApp();
  const [text, setText] = useState(""),
    [q, setQ] = useState(""),
    [category, setCategory] = useState("All"),
    [filters, setFilters] = useState(false),
    [min, setMin] = useState(""),
    [max, setMax] = useState(""),
    [rating, setRating] = useState("Any"),
    [coords, setCoords] = useState<{
      latitude: number;
      longitude: number;
    } | null>(null),
    [applied, setApplied] = useState<SearchInput>({});
  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 350);
    return () => clearTimeout(t);
  }, [text]);
  const query = useInfiniteQuery({
    queryKey: ["search", q, category, coords, applied],
    queryFn: ({ pageParam }) =>
      api.search(
        {
          ...applied,
          query: q,
          category: category === "All" ? "" : category,
          ...coords,
        },
        pageParam,
      ),
    initialPageParam: 0,
    getNextPageParam: (last, pages) =>
      last.length === 12 ? pages.length * 12 : undefined,
  });
  return (
    <View style={s.screen}>
      <View style={[s.row, { paddingHorizontal: 16, paddingTop: 12, gap: 8 }]}>
        <View
          style={[
            s.row,
            {
              flex: 1,
              backgroundColor: colors.soft,
              borderRadius: 12,
              paddingHorizontal: 12,
              height: 43,
              gap: 8,
            },
          ]}
        >
          <Icon name="search-outline" size={18} color={colors.muted} />
          <TextInput
            accessibilityLabel="Search businesses and products"
            value={text}
            onChangeText={setText}
            style={{ flex: 1, fontSize: 14 }}
            placeholder="Search shops, products, categories"
            autoCapitalize="none"
            returnKeyType="search"
          />
          {!!text && (
            <Pressable onPress={() => setText("")}>
              <Icon name="close-circle" size={17} color={colors.muted} />
            </Pressable>
          )}
        </View>
        <IconButton
          name="options-outline"
          label="Search filters"
          onPress={() => setFilters(true)}
        />
      </View>
      <View style={{ maxHeight: 50 }}>
        <Chips
          values={["All", ...categories]}
          value={category}
          onChange={setCategory}
        />
      </View>
      {coords && (
        <Pressable
          onPress={() => setCoords(null)}
          style={{ paddingHorizontal: 18, paddingBottom: 8 }}
        >
          <Text style={{ color: colors.blue, fontSize: 12 }}>
            Nearby · within 25 km ×
          </Text>
        </Pressable>
      )}
      <FlatList
        data={query.data?.pages.flat() ?? []}
        numColumns={2}
        keyExtractor={(r) => r.kind + r.id}
        columnWrapperStyle={{ gap: 2 }}
        refreshing={query.isRefetching && !query.isFetchingNextPage}
        onRefresh={() => void query.refetch()}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage)
            void query.fetchNextPage();
        }}
        renderItem={({ item: r }) => (
          <Pressable
            style={{ flex: 1, maxWidth: "50%", marginBottom: 15 }}
            onPress={() => navigate({ name: "business", id: r.business_id })}
          >
            {r.image_url ? (
              <Photo uri={r.image_url} />
            ) : (
              <View
                style={{
                  aspectRatio: 1,
                  backgroundColor: "#f0f0f4",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="storefront-outline" size={40} color="#8d8d9a" />
                <Text
                  style={[
                    s.caption,
                    {
                      marginTop: 10,
                      paddingHorizontal: 15,
                      textAlign: "center",
                    },
                  ]}
                >
                  {r.category}
                </Text>
              </View>
            )}
            <View style={{ paddingHorizontal: 10, paddingTop: 8 }}>
              <Text numberOfLines={1} style={[s.bold, { fontSize: 13 }]}>
                {r.name}
              </Text>
              <Text style={[s.caption, { fontSize: 11 }]}>
                {r.price !== null
                  ? `₹${Number(r.price).toLocaleString("en-IN")}`
                  : r.category}
              </Text>
              <Text style={{ fontSize: 10, color: colors.muted, marginTop: 3 }}>
                ★ {Number(r.rating).toFixed(1)}
                {r.distance_km !== null
                  ? ` · ${r.distance_km.toFixed(1)} km`
                  : ""}
              </Text>
            </View>
          </Pressable>
        )}
        ListHeaderComponent={
          <QueryState
            loading={query.isLoading}
            error={query.error}
            retry={() => void query.refetch()}
          />
        }
        ListEmptyComponent={
          !query.isLoading && !query.error ? (
            <Empty
              title="No results yet"
              message="Try a different search or remove a filter."
              icon="search-outline"
            />
          ) : null
        }
        ListFooterComponent={<QueryState loading={query.isFetchingNextPage} />}
      />
      <Modal
        visible={filters}
        transparent
        animationType="slide"
        onRequestClose={() => setFilters(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "#0005",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              padding: 24,
              backgroundColor: "white",
              borderTopLeftRadius: 22,
              borderTopRightRadius: 22,
            }}
          >
            <View
              style={[
                s.row,
                { justifyContent: "space-between", marginBottom: 20 },
              ]}
            >
              <Text style={{ fontSize: 20, fontWeight: "700" }}>Filters</Text>
              <IconButton
                name="close"
                label="Close filters"
                onPress={() => setFilters(false)}
              />
            </View>
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Field
                  label="Min price (₹)"
                  value={min}
                  onChangeText={setMin}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Field
                  label="Max price (₹)"
                  value={max}
                  onChangeText={setMax}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
            <Text style={s.label}>Minimum rating</Text>
            <Chips
              values={["Any", "3", "4", "5"]}
              value={rating}
              onChange={setRating}
            />
            <Button
              title={coords ? "Clear nearby filter" : "Find businesses near me"}
              outline
              onPress={() =>
                void run(async () => {
                  if (coords) {
                    setCoords(null);
                    return;
                  }
                  const permission =
                    await Location.requestForegroundPermissionsAsync();
                  if (permission.status !== "granted")
                    throw new Error(
                      "Allow location access to find nearby shops.",
                    );
                  const result = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Balanced,
                  });
                  setCoords({
                    latitude: result.coords.latitude,
                    longitude: result.coords.longitude,
                  });
                }, [])
              }
            />
            <Button
              title="Show results"
              onPress={() => {
                if (max && Number(max) < Number(min)) {
                  void run(async () => {
                    throw new Error(
                      "Maximum price must be at least the minimum.",
                    );
                  }, []);
                  return;
                }
                setApplied({
                  min_price: Number(min || 0),
                  max_price: Number(max || 100000000),
                  min_rating: rating === "Any" ? 0 : Number(rating),
                });
                setFilters(false);
              }}
            />
            <Button
              title="Reset filters"
              outline
              onPress={() => {
                setMin("");
                setMax("");
                setRating("Any");
                setCoords(null);
                setApplied({});
                setCategory("All");
                setFilters(false);
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

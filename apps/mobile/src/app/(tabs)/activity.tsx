import type { ActivityItem } from "@turnout/shared";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SignInGate } from "@/components/SignInGate";
import { Muted } from "@/components/ui";
import { useApi } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { useTheme } from "@/lib/theme";

export default function ActivityScreen() {
  return (
    <SignInGate reason="Sign in to see what's happening in your groups.">
      <Activity />
    </SignInGate>
  );
}

/** Who said in or out, across all your groups, newest first. */
function Activity() {
  const t = useTheme();
  const api = useApi();
  const [items, setItems] = useState<ActivityItem[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => api.activity().then((r) => setItems(r.activity), (e: Error) => setError(e.message)), [api]);
  useFocusEffect(useCallback(() => void load(), [load]));

  return (
    <ScrollView
      style={{ backgroundColor: t.bg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
    >
      {!items && !error && <ActivityIndicator style={{ marginTop: 32 }} />}
      {error && <Text style={{ color: t.danger }}>{error}</Text>}
      {items?.length === 0 && <Muted>Nothing yet. When players answer, it shows up here.</Muted>}
      {items && items.length > 0 && (
        <View style={{ backgroundColor: t.card, borderColor: t.border, borderWidth: 1, borderRadius: 16, paddingHorizontal: 14 }}>
          {items.map((a, i) => {
            const isIn = a.status === "in";
            return (
              <Pressable
                key={`${a.groupSlug}-${a.name}-${a.at}`}
                accessibilityRole="link"
                onPress={() => router.push({ pathname: "/g/[slug]", params: { slug: a.groupSlug } })}
                style={[{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 }, i > 0 && { borderTopWidth: 1, borderColor: t.border }]}
              >
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: isIn ? t.accent : t.border }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.text, fontSize: 15 }}>
                    <Text style={{ fontWeight: "800" }}>{a.name}</Text> {isIn ? "is in" : "is out"}
                  </Text>
                  <Text style={{ color: t.muted, fontSize: 13 }} numberOfLines={1}>{a.groupName}</Text>
                </View>
                <Text style={{ color: t.muted, fontSize: 12 }}>{timeAgo(a.at)}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator } from "react-native";
import { RemindMe } from "@/components/RemindMe";
import { BackLink, Muted, Screen } from "@/components/ui";
import { memberships, type Membership } from "@/lib/api";

/** A player's reminder settings for one group, as a sheet over the group page. */
export default function RemindScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [me, setMe] = useState<Membership | null | undefined>(undefined);
  useEffect(() => {
    memberships.get(slug).then((m) => setMe(m ?? null));
  }, [slug]);
  return (
    <Screen>
      <Stack.Screen options={{ title: "Reminders" }} />
      <BackLink fallback={{ pathname: "/g/[slug]", params: { slug } }} />
      {me === undefined ? <ActivityIndicator style={{ marginTop: 48 }} /> : me ? <RemindMe slug={slug} me={me} /> : <Muted>Join the group first, then you can turn on reminders.</Muted>}
    </Screen>
  );
}

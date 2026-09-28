import type { Group } from "@turnout/shared";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { GroupFields } from "@/components/GroupFields";
import { SignInGate } from "@/components/SignInGate";
import { BackLink, Button, Muted, Screen } from "@/components/ui";
import { useApi } from "@/lib/api";
import { fromGroup, toGroupInput, type GroupFormValues } from "@/lib/groupForm";
import { useTheme } from "@/lib/theme";

export default function EditGroupScreen() {
  return (
    <SignInGate reason="Sign in to edit your group.">
      <EditGroup />
    </SignInGate>
  );
}

function EditGroup() {
  const t = useTheme();
  const api = useApi();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [group, setGroup] = useState<Group | null>(null);
  const [form, setForm] = useState<GroupFormValues | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.groupPage(slug).then(
      (p) => {
        if (!p.viewer.isOrganizer) return setError("Only the organizer can edit this group.");
        setGroup(p.group);
        setForm(fromGroup(p.group));
      },
      (e: Error) => setError(e.message),
    );
  }, [api, slug]);

  const save = async () => {
    if (!form || !group) return;
    const result = toGroupInput(form, group.timezone);
    if (!result.ok) return setError(result.error);
    setSaving(true);
    setError(null);
    try {
      await api.updateGroup(slug, result.input);
      router.back();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  if (!form || !group) {
    return <Screen>{error ? <Text style={{ color: t.danger }}>{error}</Text> : <ActivityIndicator style={{ marginTop: 48 }} />}</Screen>;
  }
  return (
    <Screen>
      <BackLink fallback={{ pathname: "/g/[slug]", params: { slug } }} label="Back to group" />
      <GroupFields value={form} onChange={setForm} timezone={group.timezone} />
      <Muted>Lowering the cap moves the latest sign-ups to the waitlist.</Muted>
      {error && <Text style={{ color: t.danger }}>{error}</Text>}
      <View style={{ flexDirection: "row" }}>
        <Button label="Save changes" onPress={save} loading={saving} big />
      </View>
    </Screen>
  );
}

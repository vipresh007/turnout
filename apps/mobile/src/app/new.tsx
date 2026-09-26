import { router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { GroupFields } from "@/components/GroupFields";
import { SignInGate } from "@/components/SignInGate";
import { Button, Card, Field, Screen } from "@/components/ui";
import { useApi } from "@/lib/api";
import { applyDraft, emptyGroupForm, toGroupInput } from "@/lib/groupForm";
import { useTheme } from "@/lib/theme";

const deviceTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

export default function NewGroupScreen() {
  return (
    <SignInGate reason="Sign in to create and manage your groups.">
      <NewGroup />
    </SignInGate>
  );
}

function NewGroup() {
  const t = useTheme();
  const api = useApi();
  const [sentence, setSentence] = useState("");
  const [form, setForm] = useState(emptyGroupForm);
  const [drafting, setDrafting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const draft = async () => {
    setDrafting(true);
    setError(null);
    try {
      setForm(applyDraft(form, (await api.draftGroup(sentence)).draft));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDrafting(false);
    }
  };

  const create = async () => {
    const result = toGroupInput(form, deviceTimezone);
    if (!result.ok) return setError(result.error);
    setSaving(true);
    setError(null);
    try {
      const { group } = await api.createGroup(result.input);
      router.replace({ pathname: "/g/[slug]", params: { slug: group.slug, created: "1" } });
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Card>
        <Text style={{ color: t.text, fontSize: 17, fontWeight: "700" }}>Describe your group</Text>
        <Field
          label="One sentence is enough"
          placeholder="Tuesday soccer at Riverside Park, 7:30pm, 14 players"
          value={sentence}
          onChangeText={setSentence}
          onSubmitEditing={draft}
          multiline
        />
        <View style={{ flexDirection: "row" }}>
          <Button label="Fill it in for me" variant="secondary" onPress={draft} loading={drafting} disabled={sentence.trim().length < 3} />
        </View>
      </Card>
      <GroupFields value={form} onChange={setForm} timezone={deviceTimezone} />
      {error && <Text style={{ color: t.danger }}>{error}</Text>}
      <View style={{ flexDirection: "row" }}>
        <Button label="Create group" onPress={create} loading={saving} big />
      </View>
    </Screen>
  );
}

import { router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { GroupFields } from "@/components/GroupFields";
import { SignInGate } from "@/components/SignInGate";
import { BackLink, Button, Card, Field, Muted, Screen } from "@/components/ui";
import { useApi } from "@/lib/api";
import { applyDraft, emptyGroupForm, toGroupInput } from "@/lib/groupForm";
import { useTheme } from "@/lib/theme";

const deviceTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

export default function NewGroupScreen() {
  return (
    <SignInGate reason="Sign in to create your group. It takes a few seconds, and you come right back here.">
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
      <BackLink fallback="/dashboard" />
      <Card>
        <Text style={{ color: t.text, fontSize: 20, fontWeight: "900" }}>Tell us about your game</Text>
        <Muted>One sentence fills in the form below.</Muted>
        <Field
          label="Your game"
          placeholder="Thursday basketball 8-10pm at GoodLife, 14 players, $10 each"
          value={sentence}
          onChangeText={setSentence}
          onSubmitEditing={draft}
          multiline
        />
        <View style={{ flexDirection: "row" }}>
          <Button label="Fill it in for me" onPress={draft} loading={drafting} disabled={sentence.trim().length < 3} />
        </View>
      </Card>
      <GroupFields value={form} onChange={setForm} timezone={deviceTimezone} />
      {error && <Text style={{ color: t.danger }}>{error}</Text>}
      <View style={{ flexDirection: "row" }}>
        <Button label="Create group" onPress={create} loading={saving} big />
      </View>
      <View style={{ flexDirection: "row" }}>
        <Button label="Cancel" variant="secondary" onPress={() => (router.canGoBack() ? router.back() : router.replace("/dashboard"))} />
      </View>
    </Screen>
  );
}

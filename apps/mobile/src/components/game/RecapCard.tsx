import { recapMessage, type GroupPage, type Recap, type ShoutoutKind } from "@turnout/shared";
import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { config } from "@/lib/config";
import { shareUrl, useApi, type Membership } from "@/lib/api";
import { hoursUntil } from "@/lib/format";
import { storage } from "@/lib/storage";
import { tint, useTheme } from "@/lib/theme";
import { Avatar } from "../Avatar";
import { Icon } from "../Icon";
import { Pop } from "../motion";
import { ShareButtons } from "../ShareCard";
import { Card, Chip, Eyebrow, SectionHeader } from "../ui";

const SHOW_FOR_HOURS = 48;

/**
 * After a game: who played, shout-outs (an MVP vote and a thanks, for players who were there), and a recap to post.
 * Shown for two days after the game; a tap on the × puts it away for that game.
 */
export function RecapCard({ page, me, slug }: { page: GroupPage; me: Membership | null; slug: string }) {
  const t = useTheme();
  const api = useApi();
  const [recap, setRecap] = useState<Recap | null | undefined>(undefined);
  const [hidden, setHidden] = useState<string | null>(null);
  const [busy, setBusy] = useState<ShoutoutKind | null>(null);
  const [picking, setPicking] = useState<ShoutoutKind | null>(null);

  const load = useCallback(() => api.recap(slug, me?.token).then((r) => setRecap(r.recap), () => setRecap(null)), [api, slug, me?.token]);
  useEffect(() => {
    load();
    storage.get(`recapHidden:${slug}`).then(setHidden);
  }, [load, slug]);

  if (!recap || hidden === recap.sessionId || -hoursUntil(recap.startsAt) > SHOW_FOR_HOURS) return null;
  const link = shareUrl(slug);
  const message = recapMessage({ name: page.group.name, activity: page.group.activity, timezone: page.group.timezone }, recap, link);
  const image = `${config.apiUrl}/og/${slug}/recap.png`;
  const others = recap.players.filter((p) => p.memberId !== me?.memberId);
  const give = async (kind: ShoutoutKind, toMemberId: string) => {
    if (!me) return;
    setBusy(kind);
    try {
      setRecap((await api.shoutout(slug, me.token, { toMemberId, kind })).recap);
      setPicking(null);
    } finally {
      setBusy(null);
    }
  };
  const nameOf = (id: string | null) => recap.players.find((p) => p.memberId === id)?.name ?? null;
  const shareInput = {
    name: page.group.name, activity: page.group.activity, location: page.group.location, timezone: page.group.timezone, cap: page.group.cap,
    startsAt: recap.startsAt, confirmed: recap.players.length, link,
  };

  return (
    <Pop>
      <Card style={{ borderColor: tint(t.energy, 0.5) }}>
        <SectionHeader
          icon="trophy"
          tone={t.energy}
          eyebrow="Last game"
          title={recap.mvp ? `MVP: ${recap.mvp.name}` : `${recap.players.length} played`}
          right={
            <Pressable accessibilityRole="button" accessibilityLabel="Hide recap" hitSlop={8} onPress={() => { setHidden(recap.sessionId); storage.set(`recapHidden:${slug}`, recap.sessionId); }}>
              <Icon name="x" size={18} color={t.muted} />
            </Pressable>
          }
        />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {recap.players.slice(0, 14).map((p) => (
            <View key={p.memberId} style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 4, paddingLeft: 4, paddingRight: 9, borderRadius: 999, backgroundColor: p.mvp > 0 ? t.energySoft : t.surface2 }}>
              <Avatar name={p.name} size={20} />
              <Text style={{ color: t.text, fontSize: 13, fontWeight: "600" }}>{p.name}</Text>
              {p.mvp > 0 && <Text style={{ color: t.energy, fontSize: 12, fontWeight: "800" }}>🏆{p.mvp > 1 ? p.mvp : ""}</Text>}
              {p.thanks > 0 && <Text style={{ color: t.accent, fontSize: 12, fontWeight: "800" }}>🙌{p.thanks > 1 ? p.thanks : ""}</Text>}
            </View>
          ))}
        </View>

        {recap.yours && others.length > 0 && (
          <View style={{ gap: 8 }}>
            <Eyebrow>Your shout-outs</Eyebrow>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Chip label={nameOf(recap.yours.mvp) ? `MVP: ${nameOf(recap.yours.mvp)}` : "Pick an MVP"} icon="trophy" tone={t.energy} selected={!!recap.yours.mvp && picking !== "mvp"} onPress={() => setPicking(picking === "mvp" ? null : "mvp")} />
              <Chip label={nameOf(recap.yours.thanks) ? `Thanks, ${nameOf(recap.yours.thanks)}` : "Say thanks"} icon="sparkles" selected={!!recap.yours.thanks && picking !== "thanks"} onPress={() => setPicking(picking === "thanks" ? null : "thanks")} />
            </View>
            {picking && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {others.map((p) => (
                  <Chip key={p.memberId} label={p.name} disabled={busy !== null} selected={recap.yours?.[picking] === p.memberId} tone={picking === "mvp" ? t.energy : t.accent} onPress={() => give(picking, p.memberId)} />
                ))}
              </View>
            )}
          </View>
        )}

        <View style={{ gap: 8 }}>
          <Text style={{ color: t.muted, fontSize: 13 }}>Post the recap in the chat{recap.voters ? ` · ${recap.voters} voted` : ""}</Text>
          <ShareButtons input={shareInput} message={`${message}\n${image}`} event="recap_shared" from="group" />
        </View>
      </Card>
    </Pop>
  );
}

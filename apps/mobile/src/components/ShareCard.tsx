import { groupShareMessage, smsUrl, whatsappUrl, type ShareInput } from "@turnout/shared";
import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { Linking, Platform, Pressable, Share, Text, View } from "react-native";
import { trackEvent } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { Card, SectionTitle, webTransition } from "./ui";

/** Invite card: the ready-to-send message plus one-tap WhatsApp, Messages, and copy/share. */
export function ShareCard({ input, title }: { input: ShareInput; title?: string }) {
  const t = useTheme();
  const [copied, setCopied] = useState(false);
  const message = groupShareMessage(input);
  const need = input.cap && !input.cancelled ? input.cap - input.confirmed : 0;
  const slug = input.link.split("/g/")[1]?.split(/[?#]/)[0];
  const shared = (via: string) => trackEvent("link_shared", slug, { via, from: "group" });

  const copyOrShare = async () => {
    shared(Platform.OS === "web" && typeof navigator.share !== "function" ? "copy" : "share");
    const canShare = Platform.OS !== "web" || typeof navigator.share === "function";
    if (canShare) {
      try {
        await Share.share({ message });
        return;
      } catch {
        // fall back to copying
      }
    }
    await Clipboard.setStringAsync(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <SectionTitle icon="megaphone">{title ?? (need > 0 ? `Need ${need} more? Share it` : "Invite people")}</SectionTitle>
      <View style={{ backgroundColor: t.bg, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: t.border }}>
        <Text style={{ color: t.muted, fontSize: 14, lineHeight: 21 }}>{message}</Text>
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <ShareButton label="WhatsApp" color="#25D366" textColor="#06240F" onPress={() => { shared("whatsapp"); Linking.openURL(whatsappUrl(message)); }} />
        <ShareButton label="Messages" color={t.card} textColor={t.text} border={t.border} onPress={() => { shared("sms"); Linking.openURL(smsUrl(message)); }} />
        <ShareButton label={copied ? "Copied" : Platform.OS === "web" ? "Copy" : "More…"} color={t.card} textColor={t.text} border={t.border} onPress={copyOrShare} />
      </View>
    </Card>
  );
}

function ShareButton({ label, color, textColor, border, onPress }: { label: string; color: string; textColor: string; border?: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ({
        flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 12, backgroundColor: color,
        borderWidth: 1, borderColor: hovered && border ? t.accent : border ?? color,
        opacity: hovered && !border ? 0.9 : 1,
        transform: [{ translateY: hovered && !pressed ? -1 : 0 }, { scale: pressed ? 0.97 : 1 }],
        ...webTransition,
      })}
    >
      <Text style={{ color: textColor, fontWeight: "800", fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}

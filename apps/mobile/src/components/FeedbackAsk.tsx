import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useApi } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { Pop } from "./motion";
import { Button, Field, webTransition } from "./ui";

type Rating = "great" | "okay" | "missing";
const OPTIONS: { rating: Rating; face: string; label: string }[] = [
  { rating: "great", face: "😀", label: "Great" },
  { rating: "okay", face: "😐", label: "It's okay" },
  { rating: "missing", face: "😕", label: "Something's missing" },
];

/** Asked once, after an organizer has run a few games: how's it working? Anything short of great asks what they were trying to do. */
export function FeedbackAsk() {
  const t = useTheme();
  const api = useApi();
  const [rating, setRating] = useState<Rating | null>(null);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);

  const pick = (r: Rating) => {
    setRating(r);
    if (r === "great") {
      api.feedback({ source: "checkin", rating: r }).catch(() => {});
      setDone(true);
    }
  };

  if (done) {
    return (
      <Pop style={{ backgroundColor: t.soft, borderRadius: 16, padding: 14 }}>
        <Text style={{ color: t.text, fontWeight: "700" }}>Thanks! That really helps. 🙏</Text>
      </Pop>
    );
  }
  return (
    <Pop style={{ backgroundColor: t.card, borderColor: t.accent, borderWidth: 1, borderRadius: 20, padding: 18, gap: 12 }}>
      <Text style={{ color: t.text, fontSize: 17, fontWeight: "800" }}>How's Turnout working for your group?</Text>
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        {OPTIONS.map((o) => (
          <Pressable
            key={o.rating}
            accessibilityRole="button"
            accessibilityState={{ selected: rating === o.rating }}
            onPress={() => pick(o.rating)}
            style={({ hovered }: { hovered?: boolean }) => ({
              flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1,
              borderColor: rating === o.rating || hovered ? t.accent : t.border, backgroundColor: rating === o.rating ? t.soft : t.bg, ...webTransition,
            })}
          >
            <Text style={{ fontSize: 20 }}>{o.face}</Text>
            <Text style={{ color: t.text, fontWeight: "700" }}>{o.label}</Text>
          </Pressable>
        ))}
      </View>
      {rating && rating !== "great" && (
        <Pop style={{ gap: 8 }}>
          <Field label="What were you trying to do?" placeholder="e.g. add a sub for one week" value={message} onChangeText={setMessage} multiline />
          <View style={{ flexDirection: "row" }}>
            <Button
              label="Send"
              onPress={() => {
                api.feedback({ source: "checkin", rating, message }).catch(() => {});
                setDone(true);
              }}
            />
          </View>
        </Pop>
      )}
    </Pop>
  );
}

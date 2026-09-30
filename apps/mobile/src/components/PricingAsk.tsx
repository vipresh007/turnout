import { useState } from "react";
import { Text, View } from "react-native";
import { useApi } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { Pop } from "./motion";
import { Button, Field } from "./ui";

/** Asked once, after an organizer has run a few games: would Turnout be worth $49/year? Nothing is charged. */
export function PricingAsk() {
  const t = useTheme();
  const api = useApi();
  const [answer, setAnswer] = useState<"yes" | "maybe" | "no" | null>(null);
  const [reason, setReason] = useState("");
  const [sent, setSent] = useState(false);

  const pick = (a: "yes" | "maybe" | "no") => {
    setAnswer(a);
    api.pricing(a, "dashboard").catch(() => {});
  };
  const sendReason = () => {
    if (answer && reason.trim()) api.pricing(answer, "dashboard", reason).catch(() => {});
    setSent(true);
  };

  if (sent) return null;
  return (
    <Pop style={{ backgroundColor: t.card, borderColor: t.accent, borderWidth: 1, borderRadius: 20, padding: 18, gap: 12 }}>
      {!answer ? (
        <>
          <View style={{ gap: 4 }}>
            <Text style={{ color: t.text, fontSize: 17, fontWeight: "800" }}>Turnout has been running your group for a while 🙌</Text>
            <Text style={{ color: t.text }}>Would you keep it for $49/year? Nothing changes today, and everything stays free until we tell you.</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button label="Yes, I'd keep it" onPress={() => pick("yes")} />
            <Button label="Maybe" variant="secondary" onPress={() => pick("maybe")} />
            <Button label="No" variant="secondary" onPress={() => pick("no")} />
          </View>
        </>
      ) : (
        <>
          <Text style={{ color: t.text, fontWeight: "800" }}>
            {answer === "yes" ? "Thank you! Your founding price is locked." : "Thanks for being honest."}{" "}
            {answer === "no" ? "What would make it worth paying for?" : "What would make it (more) worth it?"}
          </Text>
          <Field label="Optional" placeholder="One line is plenty" value={reason} onChangeText={setReason} multiline />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button label={reason.trim() ? "Send" : "Done"} onPress={sendReason} />
          </View>
        </>
      )}
    </Pop>
  );
}

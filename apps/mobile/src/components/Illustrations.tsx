import Svg, { Circle, Line, Path, Rect } from "react-native-svg";
import { useTheme } from "@/lib/theme";

// Small line scenes for empty states and headers. Two colours only (ink + accent), stroke 2, so they read at 120px
// and match Icon.tsx. Nothing here is decorative noise: each one says what the empty screen is waiting for.

export type IllustrationName = "emptyRoster" | "noGroups" | "noStats" | "cancelled" | "wrap";

export function Illustration({ name, size = 120, tone }: { name: IllustrationName; size?: number; tone?: string }) {
  const t = useTheme();
  const ink = t.muted;
  const pop = tone ?? t.accent;
  const common = { fill: "none", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" accessibilityRole="image">
      {name === "emptyRoster" && (
        <>
          {/* three empty seats and a ball rolling in */}
          <Rect x="14" y="56" width="26" height="22" rx="6" stroke={ink} {...common} />
          <Rect x="47" y="56" width="26" height="22" rx="6" stroke={ink} {...common} />
          <Rect x="80" y="56" width="26" height="22" rx="6" stroke={ink} {...common} />
          <Line x1="20" y1="90" x2="100" y2="90" stroke={ink} {...common} strokeDasharray="4 6" />
          <Circle cx="92" cy="34" r="11" stroke={pop} {...common} />
          <Path d="M84 27c5 4 11 4 16 0M84 41c5-4 11-4 16 0" stroke={pop} {...common} />
          <Path d="M60 30c6-8 14-8 20-2" stroke={pop} {...common} strokeDasharray="3 5" />
        </>
      )}
      {name === "noGroups" && (
        <>
          {/* a pinned link card, waiting to be shared */}
          <Rect x="22" y="30" width="76" height="64" rx="12" stroke={ink} {...common} />
          <Line x1="36" y1="50" x2="72" y2="50" stroke={ink} {...common} />
          <Line x1="36" y1="64" x2="84" y2="64" stroke={ink} {...common} />
          <Line x1="36" y1="78" x2="60" y2="78" stroke={ink} {...common} />
          <Circle cx="94" cy="30" r="12" fill={pop} />
          <Path d="M89 30l4 4 7-8" stroke={t.accentText} {...common} strokeWidth={2.4} />
        </>
      )}
      {name === "noStats" && (
        <>
          {/* bars still to be filled */}
          <Line x1="20" y1="92" x2="100" y2="92" stroke={ink} {...common} />
          <Rect x="28" y="62" width="14" height="30" rx="4" stroke={ink} {...common} strokeDasharray="4 4" />
          <Rect x="52" y="48" width="14" height="44" rx="4" stroke={ink} {...common} strokeDasharray="4 4" />
          <Rect x="76" y="34" width="14" height="58" rx="4" stroke={pop} {...common} />
          <Path d="M30 42l24-12 24-8" stroke={pop} {...common} strokeDasharray="3 5" />
        </>
      )}
      {name === "cancelled" && (
        <>
          {/* a calendar day crossed off */}
          <Rect x="26" y="30" width="68" height="64" rx="12" stroke={ink} {...common} />
          <Line x1="26" y1="48" x2="94" y2="48" stroke={ink} {...common} />
          <Line x1="42" y1="22" x2="42" y2="36" stroke={ink} {...common} />
          <Line x1="78" y1="22" x2="78" y2="36" stroke={ink} {...common} />
          <Path d="M48 60l24 22M72 60L48 82" stroke={pop} {...common} strokeWidth={2.6} />
        </>
      )}
      {name === "wrap" && (
        <>
          {/* a trophy for the end of a season */}
          <Path d="M42 30h36v18c0 10-8 18-18 18s-18-8-18-18V30z" stroke={pop} {...common} />
          <Path d="M42 36H30c0 10 5 16 12 18M78 36h12c0 10-5 16-12 18" stroke={pop} {...common} />
          <Line x1="60" y1="66" x2="60" y2="80" stroke={ink} {...common} />
          <Rect x="44" y="80" width="32" height="10" rx="4" stroke={ink} {...common} />
        </>
      )}
    </Svg>
  );
}

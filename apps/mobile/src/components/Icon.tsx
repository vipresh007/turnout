import type { ReactNode } from "react";
import type { ColorValue } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";

// One line-icon set for the whole app, so every screen's chrome looks the same. Emoji stay in share messages,
// where they travel to WhatsApp, but nowhere in the UI itself.

export type IconName =
  | "edit" | "bell" | "teams" | "calendar" | "people" | "chart" | "clock" | "key" | "refresh" | "cash"
  | "pin" | "megaphone" | "check" | "x" | "hourglass" | "warning" | "link" | "sparkles" | "mail" | "bulb"
  | "trending" | "flag" | "shuffle" | "bolt" | "eye" | "user" | "plus" | "chevronDown" | "chevronRight" | "arrowRight" | "trophy" | "note";

export function Icon({ name, size = 20, color, strokeWidth = 1.8 }: { name: IconName; size?: number; color: ColorValue; strokeWidth?: number }) {
  const p = { stroke: color, strokeWidth, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
  const paths: Record<IconName, ReactNode> = {
    edit: <Path {...p} d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />,
    bell: <Path {...p} d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0" />,
    teams: <><Path {...p} d="M4 7h11M4 7l3-3M4 7l3 3" /><Path {...p} d="M20 17H9m11 0-3-3m3 3-3 3" /></>,
    calendar: <><Rect {...p} x="3.5" y="5" width="17" height="15" rx="2.5" /><Path {...p} d="M3.5 10h17M8 3v4M16 3v4" /></>,
    people: <><Circle {...p} cx="9" cy="8" r="3.5" /><Path {...p} d="M2.5 20c.6-3.5 3.3-5.5 6.5-5.5s5.9 2 6.5 5.5" /><Circle {...p} cx="17" cy="9" r="2.5" /><Path {...p} d="M16.5 14.6c2.6.2 4.4 1.9 5 4.9" /></>,
    chart: <Path {...p} d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
    clock: <><Circle {...p} cx="12" cy="12" r="8.5" /><Path {...p} d="M12 7.5V12l3 2" /></>,
    key: <><Circle {...p} cx="8" cy="15" r="4" /><Path {...p} d="m11 12 8.5-8.5M16 7l2.5 2.5M14 9l2 2" /></>,
    refresh: <Path {...p} d="M20 12a8 8 0 1 1-2.4-5.7M20 4v5h-5" />,
    cash: <><Rect {...p} x="2.5" y="6" width="19" height="12" rx="2.5" /><Circle {...p} cx="12" cy="12" r="2.5" /></>,
    pin: <><Path {...p} d="M12 21s-6.5-5.6-6.5-10.5a6.5 6.5 0 1 1 13 0C18.5 15.4 12 21 12 21z" /><Circle {...p} cx="12" cy="10.5" r="2.3" /></>,
    megaphone: <Path {...p} d="M4 10h3l8-5v14l-8-5H4zM18 9.5a3.5 3.5 0 0 1 0 5" />,
    check: <Path {...p} d="M5 12.5l4.5 4.5L19 7.5" />,
    x: <Path {...p} d="M6 6l12 12M18 6 6 18" />,
    hourglass: <Path {...p} d="M7 3h10M7 21h10M8 3c0 5 4 5.5 4 9s-4 4-4 9M16 3c0 5-4 5.5-4 9s4 4 4 9" />,
    warning: <Path {...p} d="M12 4 2.5 20h19L12 4zM12 10v4M12 17v.5" />,
    link: <Path {...p} d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.5 1.5M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.5-1.5" />,
    sparkles: <Path {...p} d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16z" />,
    mail: <><Rect {...p} x="3" y="5" width="18" height="14" rx="2.5" /><Path {...p} d="M3 8l9 6 9-6" /></>,
    bulb: <Path {...p} d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.7.6 1 1.3 1 2.1h5c0-.8.3-1.5 1-2.1A6 6 0 0 0 12 3z" />,
    trending: <Path {...p} d="M3 17l6-6 4 4 8-8M15 7h6v6" />,
    flag: <Path {...p} d="M5 21V4M5 4h11l-2 4 2 4H5" />,
    shuffle: <Path {...p} d="M3 7h3l9 10h6M18 7h3m0 0-2-2m2 2-2 2M21 17l-2-2m2 2-2 2M3 17h3l3-3.3" />,
    bolt: <Path {...p} d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />,
    eye: <><Path {...p} d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" /><Circle {...p} cx="12" cy="12" r="3" /></>,
    user: <><Circle {...p} cx="12" cy="8" r="4" /><Path {...p} d="M4 21c.8-4 4-6 8-6s7.2 2 8 6" /></>,
    plus: <Path {...p} d="M12 5v14M5 12h14" />,
    chevronDown: <Path {...p} d="M6 9l6 6 6-6" />,
    chevronRight: <Path {...p} d="M9 6l6 6-6 6" />,
    arrowRight: <Path {...p} d="M5 12h14M13 6l6 6-6 6" />,
    trophy: <Path {...p} d="M8 4h8v5a4 4 0 0 1-8 0V4zM8 6H5a3 3 0 0 0 3 3M16 6h3a3 3 0 0 1-3 3M12 13v4M9 21h6M10 17h4" />,
    note: <Path {...p} d="M6 3h9l4 4v14H6zM15 3v4h4M9 12h6M9 16h6" />,
  };
  return <Svg width={size} height={size} viewBox="0 0 24 24">{paths[name]}</Svg>;
}

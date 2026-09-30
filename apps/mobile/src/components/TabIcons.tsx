import type { ColorValue } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

// Simple line icons for the app's tab bar, drawn to match the rest of Turnout.
type IconProps = { color: ColorValue; size?: number };
const stroke = (color: ColorValue) => ({ stroke: color, strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" });

export const HomeIcon = ({ color, size = 24 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path {...stroke(color)} d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
  </Svg>
);

export const GroupsIcon = ({ color, size = 24 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Circle {...stroke(color)} cx="9" cy="8" r="3.5" />
    <Path {...stroke(color)} d="M2.5 20c.6-3.5 3.3-5.5 6.5-5.5s5.9 2 6.5 5.5" />
    <Circle {...stroke(color)} cx="17" cy="9" r="2.5" />
    <Path {...stroke(color)} d="M16.5 14.6c2.6.2 4.4 1.9 5 4.9" />
  </Svg>
);

export const ActivityIcon = ({ color, size = 24 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path {...stroke(color)} d="M3 12h4l3-8 4 16 3-8h4" />
  </Svg>
);

export const AccountIcon = ({ color, size = 24 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Circle {...stroke(color)} cx="12" cy="8" r="4" />
    <Path {...stroke(color)} d="M4 21c.8-4 4-6 8-6s7.2 2 8 6" />
  </Svg>
);

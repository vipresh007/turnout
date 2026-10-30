import { Redirect } from "expo-router";

/** The Insights tab used to live at /activity. */
export default function ActivityRedirect() {
  return <Redirect href="/insights" />;
}

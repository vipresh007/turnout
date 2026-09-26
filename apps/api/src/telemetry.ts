// Loaded with `node --import` so instrumentation is in place before fastify and pg are loaded.
import { useAzureMonitor } from "@azure/monitor-opentelemetry";

if (process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
  useAzureMonitor();
}

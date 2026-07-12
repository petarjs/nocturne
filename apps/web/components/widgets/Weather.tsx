import { WeatherCard } from "@/lib/archetypes/weatherCard";
import type { WidgetSlot } from "@/lib/layout/types";

export function Weather({ slot = "supporting", ...props }: {
  slot?: WidgetSlot;
  label?: string;
  tempC: number;
  condition: string;
  hi: number;
  lo: number;
  hourly?: { t: string; tempC: number }[];
}) {
  return <WeatherCard slot={slot} {...props} />;
}

import { AgendaCard } from "@/lib/archetypes/agendaCard";
import type { WidgetSlot } from "@/lib/layout/types";

type EventItem = { id: string; title: string; startsAt: string; endsAt: string };

export function Agenda({
  slot = "supporting",
  label,
  events,
}: {
  slot?: WidgetSlot;
  label?: string;
  events: EventItem[];
}) {
  return <AgendaCard slot={slot} label={label} events={events} />;
}

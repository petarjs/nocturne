import { notFound } from "next/navigation";
import { DisplayView } from "@/components/display/DisplayView";

// Local fixture mode only — dev, chaos mode, and the golden-frame harness
// (§10 criterion 7). Real dashboards live at /d/<slug>; this route is gated
// out of production so no one lands on canned demo data on a live install.
export default function DisplayPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DisplayView slug={null} />;
}

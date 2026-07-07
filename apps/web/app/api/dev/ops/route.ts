import { NextResponse } from "next/server";
import { opsBatchSchema } from "@/lib/schema";
import { reduceBatch } from "@/lib/reducer";
import { homelabScene, scenePresets } from "@/fixtures/scenes";

// Dev-only route: preserves the curl one-liner demo (§9.1) before the real
// Durable Object spine exists. Module-level state — not for production use.
let devScene = homelabScene;

export async function GET() {
  return NextResponse.json(devScene);
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = opsBatchSchema.safeParse(Array.isArray(body) ? body : [body]);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  devScene = reduceBatch(devScene, parsed.data, { scenesByName: scenePresets });
  return NextResponse.json(devScene);
}

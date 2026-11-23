import { connection } from "next/server";
import { hasLiveModel } from "@/lib/live-engine";

export async function GET() {
  await connection();
  return Response.json({ mode: hasLiveModel() ? "live" : "scripted" });
}

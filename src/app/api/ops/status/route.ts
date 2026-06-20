import { fetchOpsStatus } from "@/lib/ops-runtime";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const status = await fetchOpsStatus();
    return NextResponse.json(status);
  } catch (err) {
    const message = err instanceof Error ? err.message : "ops status failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
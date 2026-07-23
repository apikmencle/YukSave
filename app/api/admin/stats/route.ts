import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getSupabaseServerClient } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  if (!isAdminAuthenticated(req)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseServerClient();

  const now = Date.now();
  const since24h = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const since7d = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [{ count: total }, { count: last24h }, { count: last7d }, { data: recent }] =
    await Promise.all([
      supabase.from("downloads").select("id", { count: "exact", head: true }),
      supabase
        .from("downloads")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since24h),
      supabase
        .from("downloads")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since7d),
      supabase
        .from("downloads")
        .select("source_url, created_at")
        .order("created_at", { ascending: false })
        .limit(500),
    ]);

  // Tally most-requested URLs from the recent sample (cheap in-memory count,
  // fine at current scale — move to a SQL aggregate if the table grows large).
  const urlCounts = new Map<string, number>();
  for (const row of recent ?? []) {
    urlCounts.set(row.source_url, (urlCounts.get(row.source_url) ?? 0) + 1);
  }
  const topUrls = [...urlCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([url, count]) => ({ url, count }));

  return NextResponse.json({
    total: total ?? 0,
    last24h: last24h ?? 0,
    last7d: last7d ?? 0,
    topUrls,
  });
}

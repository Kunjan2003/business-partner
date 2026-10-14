export function explainError(error: unknown): string {
  if (error && typeof error === "object" && "issues" in error) {
    const issues = (
      error as { issues: { path: (string | number)[]; message: string }[] }
    ).issues;
    if (issues?.[0])
      return `${issues[0].path.join(" ").replace(/_/g, " ") || "Input"}: ${issues[0].message}`;
  }
  const e = error as { message?: string; code?: string; details?: string };
  if (e?.code === "PGRST200" || e?.code === "PGRST202" || e?.code === "42P01")
    return "The backend database is missing an update. Apply the repository’s Supabase migrations, then retry.";
  if (e?.code === "PGRST116")
    return "This item is unavailable or you do not have access. Refresh and try again.";
  if (e?.code === "42501")
    return "You do not have permission for this action. Check your account role and backend policies.";
  if (
    e?.message?.includes("Network request failed") ||
    e?.message?.includes("Failed to fetch")
  )
    return "Could not connect. Check your internet connection and retry.";
  if (e?.message?.includes("Bucket not found"))
    return "Photo storage has not been configured. Apply the Supabase migrations.";
  if (e?.message) return e.message;
  return "Something went wrong. Please try again.";
}

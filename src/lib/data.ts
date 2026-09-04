import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

export async function getCurrentProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return profile ? { ...profile, email: user.email } : null;
}

export async function getAllMembersForAdmin() {
  const supabase = await createClient();
  const { data } = await supabase.from("public_profiles").select("id, full_name").order("full_name");
  return data ?? [];
}

export async function getActiveServices() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("services")
    .select("*")
    .eq("active", true)
    .order("price_cents", { ascending: true });

  return data ?? [];
}

export async function getActiveAnnouncements() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("announcements")
    .select("*")
    .eq("published", true)
    .or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`)
    .order("created_at", { ascending: false });

  return data ?? [];
}

export async function getLatestAnnouncementAt() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("announcements")
    .select("created_at")
    .eq("published", true)
    .or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.created_at ?? null;
}

export async function getAllAnnouncements() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("announcements")
    .select("*")
    .order("created_at", { ascending: false });

  return data ?? [];
}

export async function getAllServices() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("services")
    .select("*")
    .order("price_cents", { ascending: true });

  return data ?? [];
}

export async function getBusinessHours() {
  const supabase = await createClient();
  const { data } = await supabase.from("business_hours").select("*").order("day_of_week");
  return data ?? [];
}

export async function getBookingSettings() {
  const supabase = await createClient();
  const { data } = await supabase.from("booking_settings").select("*").single();
  return data;
}

export async function getUpcomingAppointments(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("appointments")
    .select("*, services(name, duration_minutes)")
    .eq("user_id", userId)
    .neq("status", "cancelled")
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true });

  return data ?? [];
}

// Admin-only: every confirmed (not yet completed/cancelled) appointment
// across all members, for the "mark paid & completed" action.
export async function getConfirmedAppointmentsForAdmin() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("appointments")
    .select("*, services(name)")
    .eq("status", "confirmed")
    .order("starts_at", { ascending: true });

  const rows = data ?? [];
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  if (userIds.length === 0) return [];

  const { data: profiles } = await supabase.from("public_profiles").select("id, full_name").in("id", userIds);
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  return rows.map((r) => ({ ...r, memberName: nameById.get(r.user_id) ?? "A member" }));
}

export async function getAppointmentHistory(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("appointments")
    .select("*, services(name, duration_minutes), visit_photos(id, image_url)")
    .eq("user_id", userId)
    .lt("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: false });

  return data ?? [];
}

export async function getPaymentHistory(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select("*, appointments(services(name))")
    .eq("user_id", userId)
    .order("paid_at", { ascending: false });

  return data ?? [];
}

export async function getMessages(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("messages")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  return data ?? [];
}

// One row per member who has ever messaged the studio, newest activity
// first, with how many of their messages are unread. Relies on the
// "messages: admins read all" RLS policy rather than the service role,
// same as the other admin-read helpers in this file.
export async function getMessageThreadsForAdmin() {
  const supabase = await createClient();
  const { data: messages } = await supabase
    .from("messages")
    .select("*")
    .order("created_at", { ascending: false });

  const rows = messages ?? [];
  const userIds = [...new Set(rows.map((m) => m.user_id))];
  if (userIds.length === 0) return [];

  const { data: profiles } = await supabase.from("public_profiles").select("id, full_name").in("id", userIds);
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  const threads = new Map<
    string,
    { userId: string; memberName: string; lastMessage: string; lastAt: string; unreadCount: number }
  >();

  for (const m of rows) {
    if (!threads.has(m.user_id)) {
      threads.set(m.user_id, {
        userId: m.user_id,
        memberName: nameById.get(m.user_id) ?? "A member",
        lastMessage: m.body,
        lastAt: m.created_at,
        unreadCount: 0,
      });
    }
    if (m.sender === "member" && !m.read_at) {
      threads.get(m.user_id)!.unreadCount += 1;
    }
  }

  return [...threads.values()].sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));
}

export async function getLookBookPhotos(currentUserId: string) {
  const supabase = await createClient();
  const { data: photos } = await supabase
    .from("visit_photos")
    .select("*, photo_likes(user_id)")
    .order("created_at", { ascending: false })
    .limit(60);

  const userIds = [...new Set((photos ?? []).map((p) => p.user_id))];
  // public_profiles is a view (see 0005_phase2_schema.sql), so it can't be
  // embedded via a foreign-key join above — fetch it separately and merge.
  const { data: authors } =
    userIds.length > 0
      ? await supabase.from("public_profiles").select("id, full_name").in("id", userIds)
      : { data: [] };

  const nameById = new Map((authors ?? []).map((a) => [a.id, a.full_name]));

  return (photos ?? []).map((photo) => ({
    ...photo,
    authorName: nameById.get(photo.user_id) ?? "A member",
    likeCount: photo.photo_likes.length,
    likedByMe: photo.photo_likes.some((like: { user_id: string }) => like.user_id === currentUserId),
  }));
}

export async function getMyCollections(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("collections")
    .select("*, collection_photos(photo_id, visit_photos(image_url))")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  return data ?? [];
}

export async function getCollection(collectionId: string, userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("collections")
    .select("*, collection_photos(photo_id, visit_photos(id, image_url))")
    .eq("id", collectionId)
    .eq("user_id", userId)
    .maybeSingle();

  return data;
}

export async function getVisitCount(userId: string) {
  const supabase = await createClient();
  const { count } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "completed");

  return count ?? 0;
}

// === Loyalty credit ledger ====================================================

export async function getRewardSettings() {
  const supabase = await createClient();
  const { data } = await supabase.from("reward_settings").select("*").single();
  return data;
}

export async function getCreditHistory(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reward_credits")
    .select("*")
    .eq("user_id", userId)
    .order("earned_at", { ascending: false });

  return data ?? [];
}

// Sum of what's actually spendable right now: confirmed, not expired, and
// not fully redeemed yet. Computed here rather than in a DB function since
// members can already read their own reward_credits rows via RLS.
export async function getCreditBalance(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reward_credits")
    .select("amount, redeemed_amount")
    .eq("user_id", userId)
    .eq("status", "confirmed")
    .gt("expires_at", new Date().toISOString());

  return (data ?? []).reduce((sum, row) => sum + (row.amount - row.redeemed_amount), 0);
}

// Total ever earned, for the tier/badge display — counts confirmed,
// redeemed, and expired lines (all of which were legitimately earned at
// the time), but not pending (not yet real) or rejected (revoked).
export async function getLifetimeEarned(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reward_credits")
    .select("amount")
    .eq("user_id", userId)
    .in("status", ["confirmed", "redeemed", "expired"]);

  return (data ?? []).reduce((sum, row) => sum + row.amount, 0);
}

export async function getReferralInvites(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("referral_invites")
    .select("*")
    .eq("referrer_id", userId)
    .order("created_at", { ascending: false });

  return data ?? [];
}

export async function getActiveReviewPlatforms() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("review_platforms")
    .select("*")
    .eq("is_active", true)
    .order("name");

  return data ?? [];
}

export async function getAllReviewPlatforms() {
  const supabase = await createClient();
  const { data } = await supabase.from("review_platforms").select("*").order("name");
  return data ?? [];
}

export async function getMyReviewSubmissions(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("review_submissions")
    .select("*, review_platforms(name)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  return data ?? [];
}

export async function getMyRepostSubmissions(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("repost_submissions")
    .select("*, announcements(title)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  return data ?? [];
}

// Posts a member can currently claim the repost credit for: admin-flagged
// shareable, inside its optional date window, and not already
// pending/approved by this member (a `not in (...)` on their existing
// submissions, computed here rather than a DB-side anti-join for clarity).
export async function getClaimableShareablePosts(userId: string) {
  const supabase = await createClient();
  const now = new Date().toISOString();

  const [{ data: posts }, { data: existing }] = await Promise.all([
    supabase
      .from("announcements")
      .select("id, title, description, image_url")
      .eq("is_shareable", true)
      .eq("published", true)
      .or(`shareable_starts_at.is.null,shareable_starts_at.lte.${now}`)
      .or(`shareable_ends_at.is.null,shareable_ends_at.gte.${now}`),
    supabase
      .from("repost_submissions")
      .select("announcement_id")
      .eq("user_id", userId)
      .neq("status", "rejected"),
  ]);

  const claimedIds = new Set((existing ?? []).map((s) => s.announcement_id));
  return (posts ?? []).filter((p) => !claimedIds.has(p.id));
}

// public_profiles is a view (see 0005_phase2_schema.sql), so — same
// limitation as getLookBookPhotos above — it can't be embedded via a
// foreign-key join. Fetch member names separately and merge them in.
async function attachMemberNames<T extends { user_id: string }>(rows: T[]) {
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  if (userIds.length === 0) return rows.map((r) => ({ ...r, memberName: "A member" }));

  const supabase = await createClient();
  const { data: profiles } = await supabase
    .from("public_profiles")
    .select("id, full_name")
    .in("id", userIds);

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  return rows.map((r) => ({ ...r, memberName: nameById.get(r.user_id) ?? "A member" }));
}

export async function getPendingReviewSubmissions() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("review_submissions")
    .select("*, review_platforms(name)")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  return attachMemberNames(data ?? []);
}

export async function getPendingRepostSubmissions() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("repost_submissions")
    .select("*, announcements(title)")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  return attachMemberNames(data ?? []);
}

export async function getAllCreditsWithMember() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reward_credits")
    .select("*")
    .order("earned_at", { ascending: false })
    .limit(200);

  return attachMemberNames(data ?? []);
}

export async function getCalendarConnection(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("calendar_connections")
    .select("user_id, connected_at, calendar_id")
    .eq("user_id", userId)
    .maybeSingle();

  return data;
}

// === Admin client directory ====================================================

export type AdminClientRow = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  memberSince: string;
  totalBookings: number;
  noShows: number;
  cancellations: number;
  lastVisitAt: string | null;
  nextAppointmentAt: string | null;
  totalSpentCents: number;
  creditBalance: number;
  lifetimeEarned: number;
  referralsSent: number;
  referralsConfirmed: number;
};

// Admin-only, so this reads via the service role rather than adding an
// admin RLS carve-out to `profiles` — it already needs the service role's
// auth.admin API to get member emails (auth.users isn't exposed through
// the normal data API at all), so there's no simpler RLS-only path anyway.
export async function getAllClientsForAdmin(): Promise<AdminClientRow[]> {
  const serviceRole = createServiceRoleClient();
  const now = new Date().toISOString();

  const [{ data: profiles }, { data: userList }, { data: appointments }, { data: payments }, { data: credits }, { data: invites }] =
    await Promise.all([
      serviceRole.from("profiles").select("id, full_name, avatar_url, phone, created_at, is_admin"),
      serviceRole.auth.admin.listUsers({ perPage: 1000 }),
      serviceRole.from("appointments").select("user_id, status, starts_at"),
      serviceRole.from("payments").select("user_id, amount_cents, status"),
      serviceRole.from("reward_credits").select("user_id, amount, redeemed_amount, status, expires_at"),
      serviceRole.from("referral_invites").select("referrer_id, status"),
    ]);

  const emailById = new Map(userList?.users.map((u) => [u.id, u.email ?? null]) ?? []);

  return (profiles ?? [])
    .filter((p) => !p.is_admin)
    .map((profile) => {
      const myAppointments = (appointments ?? []).filter((a) => a.user_id === profile.id);
      const myPayments = (payments ?? []).filter((p) => p.user_id === profile.id);
      const myCredits = (credits ?? []).filter((c) => c.user_id === profile.id);
      const myInvites = (invites ?? []).filter((i) => i.referrer_id === profile.id);

      const completed = myAppointments.filter((a) => a.status === "completed");
      const upcoming = myAppointments
        .filter((a) => a.status === "confirmed" && a.starts_at > now)
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
      const lastVisit = completed.sort((a, b) => b.starts_at.localeCompare(a.starts_at))[0];

      return {
        id: profile.id,
        fullName: profile.full_name ?? "Unnamed member",
        email: emailById.get(profile.id) ?? null,
        phone: profile.phone,
        avatarUrl: profile.avatar_url,
        memberSince: profile.created_at,
        totalBookings: completed.length,
        noShows: myAppointments.filter((a) => a.status === "no_show").length,
        cancellations: myAppointments.filter((a) => a.status === "cancelled").length,
        lastVisitAt: lastVisit?.starts_at ?? null,
        nextAppointmentAt: upcoming[0]?.starts_at ?? null,
        totalSpentCents: myPayments
          .filter((p) => p.status === "paid")
          .reduce((sum, p) => sum + p.amount_cents, 0),
        creditBalance: myCredits
          .filter((c) => c.status === "confirmed" && c.expires_at > now)
          .reduce((sum, c) => sum + (c.amount - c.redeemed_amount), 0),
        lifetimeEarned: myCredits
          .filter((c) => ["confirmed", "redeemed", "expired"].includes(c.status))
          .reduce((sum, c) => sum + c.amount, 0),
        referralsSent: myInvites.length,
        referralsConfirmed: myInvites.filter((i) => i.status === "confirmed").length,
      };
    });
}

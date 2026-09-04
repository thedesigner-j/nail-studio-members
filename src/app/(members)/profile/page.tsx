import { getCurrentProfile } from "@/lib/data";
import ProfileForm from "./profile-form";
import AvatarUploader from "./avatar-uploader";

export default async function ProfilePage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-neutral-900">Your profile</h1>

      <AvatarUploader userId={profile.id} avatarUrl={profile.avatar_url} />
      <ProfileForm profile={profile} />
    </div>
  );
}

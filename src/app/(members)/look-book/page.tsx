import Link from "next/link";
import { getCurrentProfile, getLookBookPhotos, getMyCollections } from "@/lib/data";
import PhotoCard from "./photo-card";

export default async function LookBookPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const [photos, collections] = await Promise.all([
    getLookBookPhotos(profile.id),
    getMyCollections(profile.id),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Look Book</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Nail art from everyone&apos;s visits — save your favorites into collections.
          </p>
        </div>
        <Link href="/collections" className="text-sm font-medium text-neutral-600 underline">
          My collections
        </Link>
      </div>

      {photos.length === 0 ? (
        <p className="text-sm text-neutral-500">
          No photos yet — add some from a past visit on the Appointments page.
        </p>
      ) : (
        <div className="columns-2 gap-3 sm:columns-3 lg:columns-4">
          {photos.map((photo) => (
            <div key={photo.id} className="mb-3 break-inside-avoid">
              <PhotoCard
                photo={{
                  id: photo.id,
                  imageUrl: photo.image_url,
                  authorName: photo.authorName,
                  likeCount: photo.likeCount,
                  likedByMe: photo.likedByMe,
                }}
                collections={collections.map((c) => ({ id: c.id, name: c.name }))}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

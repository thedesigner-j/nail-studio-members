import { notFound } from "next/navigation";
import Image from "next/image";
import { getCurrentProfile, getCollection } from "@/lib/data";
import { removeFromCollection } from "../actions";

export default async function CollectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const collection = await getCollection(id, profile.id);
  if (!collection) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-neutral-900">{collection.name}</h1>

      {collection.collection_photos.length === 0 ? (
        <p className="text-sm text-neutral-500">No photos in this collection yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {collection.collection_photos.map((cp: { photo_id: string; visit_photos: { image_url: string } | null }) => (
            <div key={cp.photo_id} className="group relative aspect-square overflow-hidden rounded-2xl">
              <Image
                src={cp.visit_photos!.image_url}
                alt=""
                fill
                unoptimized
                className="object-cover"
              />
              <form action={removeFromCollection} className="absolute inset-0 hidden group-hover:block">
                <input type="hidden" name="collectionId" value={collection.id} />
                <input type="hidden" name="photoId" value={cp.photo_id} />
                <button
                  type="submit"
                  className="absolute right-2 top-2 rounded bg-black/60 px-2 py-1 text-xs text-white"
                >
                  Remove
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

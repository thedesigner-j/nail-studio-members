import Link from "next/link";
import Image from "next/image";
import { getCurrentProfile, getMyCollections } from "@/lib/data";

export default async function CollectionsPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const collections = await getMyCollections(profile.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">My collections</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Photos you&apos;ve saved from the visit feed. Create a new collection from any photo.
        </p>
      </div>

      {collections.length === 0 ? (
        <p className="text-sm text-neutral-500">
          No collections yet — save a photo from the{" "}
          <Link href="/look-book" className="underline">
            Look Book
          </Link>{" "}
          to start one.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {collections.map((collection) => (
            <Link
              key={collection.id}
              href={`/collections/${collection.id}`}
              className="card transition-colors hover:border-neutral-400"
            >
              <p className="font-medium text-neutral-900">{collection.name}</p>
              <p className="mb-2 text-xs text-neutral-400">
                {collection.collection_photos.length} photo
                {collection.collection_photos.length === 1 ? "" : "s"}
              </p>
              <div className="flex -space-x-2">
                {collection.collection_photos.slice(0, 4).map((cp: { visit_photos: { image_url: string } | null }, i: number) => (
                  <div
                    key={i}
                    className="relative h-10 w-10 overflow-hidden rounded-full border-2 border-white"
                  >
                    <Image
                      src={cp.visit_photos!.image_url}
                      alt=""
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  </div>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

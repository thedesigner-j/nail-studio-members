"use client";

import { useState, useTransition } from "react";
import { toggleLike, saveToCollection, createCollectionAndSave } from "./actions";

type Photo = {
  id: string;
  imageUrl: string;
  authorName: string;
  likeCount: number;
  likedByMe: boolean;
};

type Collection = { id: string; name: string };

export default function PhotoCard({
  photo,
  collections,
}: {
  photo: Photo;
  collections: Collection[];
}) {
  const [liked, setLiked] = useState(photo.likedByMe);
  const [likeCount, setLikeCount] = useState(photo.likeCount);
  const [menuOpen, setMenuOpen] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();

  function handleLikeClick() {
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount((c) => c + (wasLiked ? -1 : 1));
    startTransition(() => {
      toggleLike(photo.id, wasLiked);
    });
  }

  async function handleSaveToExisting(collectionId: string) {
    setSaveError(null);
    setSaving(true);
    const result = await saveToCollection(photo.id, collectionId);
    setSaving(false);

    if (result.error) {
      setSaveError(result.error);
      return;
    }
    setMenuOpen(false);
    setSaved(true);
  }

  async function handleCreateCollection() {
    const name = newCollectionName.trim();
    if (!name) return;

    setSaveError(null);
    setSaving(true);
    const result = await createCollectionAndSave(photo.id, name);
    setSaving(false);

    if (result.error) {
      setSaveError(result.error);
      return;
    }
    setNewCollectionName("");
    setMenuOpen(false);
    setSaved(true);
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm shadow-neutral-900/5">
      <div className="relative overflow-hidden rounded-t-2xl">
        {/* eslint-disable-next-line @next/next/no-img-element -- masonry layout needs each photo's natural aspect ratio, which next/image can't size without knowing dimensions up front */}
        <img src={photo.imageUrl} alt="Nail art" className="block w-full" />

        <button
          type="button"
          onClick={handleLikeClick}
          className={`badge absolute right-2 top-2 gap-1 bg-white/90 backdrop-blur ${
            liked ? "text-rose-600" : "text-neutral-700"
          }`}
        >
          {liked ? "♥" : "♡"} {likeCount}
        </button>
      </div>

      <div className="flex items-center justify-between p-3">
        <span className="text-xs text-neutral-500">{photo.authorName}</span>

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="btn-secondary btn-sm"
          >
            {saved ? "Saved ✓" : "Save"}
          </button>

          {menuOpen && (
            <div className="absolute right-0 z-10 mt-1 w-52 rounded-xl border border-neutral-200 bg-white p-2 shadow-lg">
              {collections.length > 0 ? (
                <ul className="mb-2 max-h-32 space-y-1 overflow-y-auto">
                  {collections.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => handleSaveToExisting(c.id)}
                        disabled={saving}
                        className="w-full rounded-lg px-2 py-1 text-left text-sm hover:bg-neutral-100 disabled:opacity-50"
                      >
                        {c.name}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mb-2 text-xs text-neutral-400">
                  No collections yet — create one below.
                </p>
              )}
              <div className="flex gap-1">
                <input
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  placeholder="New collection"
                  className="field-input px-2 py-1 text-xs"
                />
                <button
                  type="button"
                  onClick={handleCreateCollection}
                  disabled={saving || !newCollectionName.trim()}
                  className="btn-primary btn-sm px-2.5 disabled:opacity-50"
                >
                  {saving ? "..." : "Add"}
                </button>
              </div>
              {saveError && <p className="mt-2 text-xs text-red-600">{saveError}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

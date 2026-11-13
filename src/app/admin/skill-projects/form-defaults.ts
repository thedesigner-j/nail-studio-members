// Plain (non-"use client") module so server pages can import the default
// values: a value exported from a "use client" file reaches a server
// component only as a reference, not the object itself.

export type ReferenceType = "lookbook" | "upload" | "link";

export type ProjectFormInitial = {
  projectId?: string;
  title: string;
  skillTypes: string[];
  assignedTo: string;
  referenceType: ReferenceType;
  referenceLookbookPhotoId: string | null;
  // True when editing a project whose Look Book photo was deleted.
  referenceRemoved: boolean;
  referenceStoragePath: string | null;
  referencePreviewUrl: string | null;
  referenceUrl: string;
  links: { url: string; label: string }[];
  goals: { id: string | null; text: string }[];
  instructions: string;
  dueDate: string;
  priority: string;
  linkedServiceId: string;
};

export const EMPTY_PROJECT: ProjectFormInitial = {
  title: "",
  skillTypes: ["nails"],
  assignedTo: "",
  referenceType: "lookbook",
  referenceLookbookPhotoId: null,
  referenceRemoved: false,
  referenceStoragePath: null,
  referencePreviewUrl: null,
  referenceUrl: "",
  links: [],
  goals: [],
  instructions: "",
  dueDate: "",
  priority: "normal",
  linkedServiceId: "",
};

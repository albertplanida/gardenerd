import { useEffect, useRef, useState } from "react";

import type { JournalEvent, JournalPhoto } from "@/graphql/journalEvents";

import {
  PhotoUploadError,
  photoUploadMessage,
  uploadJournalPhoto,
  validatePhotoSelection,
} from "./journalPhotos";

export type PendingPhoto = {
  id: string;
  eventId: string;
  file: File;
  clientUploadId: string;
  position: number;
  previewUrl: string;
  progress: number;
  status: "queued" | "uploading" | "failed";
  error: string | null;
  rebaseOnRetry: boolean;
};

type UseJournalPhotoUploadsOptions = {
  events: JournalEvent[];
  onUploaded: (eventId: string, photo: JournalPhoto) => void;
  onRefresh: () => Promise<unknown>;
  onLifecycleConflict: () => Promise<void>;
};

function objectUrl(file: File) {
  return typeof URL.createObjectURL === "function"
    ? URL.createObjectURL(file)
    : "";
}

export function useJournalPhotoUploads({
  events,
  onUploaded,
  onRefresh,
  onLifecycleConflict,
}: UseJournalPhotoUploadsOptions) {
  const [uploads, setUploads] = useState<PendingPhoto[]>([]);
  const uploadsRef = useRef(uploads);
  const eventsRef = useRef(events);
  const processing = useRef(false);
  const activeController = useRef<AbortController | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    uploadsRef.current = uploads;
    eventsRef.current = events;
  }, [events, uploads]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      activeController.current?.abort();
      for (const upload of uploadsRef.current) {
        if (upload.previewUrl) URL.revokeObjectURL(upload.previewUrl);
      }
    };
  }, []);

  useEffect(() => {
    const next = uploads.find((upload) => upload.status === "queued");
    if (!next || processing.current) return;
    processing.current = true;
    const controller = new AbortController();
    activeController.current = controller;
    setUploads((current) =>
      current.map((upload) =>
        upload.id === next.id
          ? { ...upload, status: "uploading", progress: 0, error: null }
          : upload,
      ),
    );

    void uploadJournalPhoto(
      next.eventId,
      next.file,
      next.clientUploadId,
      next.position,
      (progress) => {
        if (!mounted.current) return;
        setUploads((current) =>
          current.map((upload) =>
            upload.id === next.id ? { ...upload, progress } : upload,
          ),
        );
      },
      controller.signal,
    )
      .then((photo) => {
        if (!mounted.current) return;
        onUploaded(next.eventId, photo);
        if (next.previewUrl) URL.revokeObjectURL(next.previewUrl);
        setUploads((current) =>
          current.filter((upload) => upload.id !== next.id),
        );
      })
      .catch(async (error: unknown) => {
        if (!mounted.current) return;
        const positionConflict =
          error instanceof PhotoUploadError &&
          error.code === "PHOTO_POSITION_CONFLICT";
        const lifecycleConflict =
          error instanceof PhotoUploadError &&
          (error.code === "GROWING_TRIAL_NOT_ACTIVE" ||
            error.code === "JOURNAL_EVENT_NOT_FOUND");
        if (positionConflict) await onRefresh();
        if (lifecycleConflict) await onLifecycleConflict();
        if (!mounted.current) return;
        setUploads((current) =>
          current.map((upload) =>
            upload.id === next.id ||
            (positionConflict &&
              upload.eventId === next.eventId &&
              upload.status === "queued") ||
            (lifecycleConflict &&
              upload.eventId === next.eventId &&
              upload.status === "queued")
              ? {
                  ...upload,
                  status: "failed",
                  error: lifecycleConflict
                    ? "This Growing Trial is no longer active. Photos are now read-only."
                    : photoUploadMessage(error),
                  rebaseOnRetry: positionConflict,
                }
              : upload,
          ),
        );
      })
      .finally(() => {
        activeController.current = null;
        processing.current = false;
        if (mounted.current) {
          setUploads((current) => [...current]);
        }
      });
  }, [uploads, onLifecycleConflict, onRefresh, onUploaded]);

  function occupied(eventId: string) {
    const persisted =
      eventsRef.current.find((event) => event.id === eventId)?.photos?.length ??
      0;
    return (
      persisted +
      uploadsRef.current.filter((item) => item.eventId === eventId).length
    );
  }

  function enqueue(eventId: string, files: File[]) {
    const errors = validatePhotoSelection(files, occupied(eventId));
    if (errors.length) return errors;
    const event = eventsRef.current.find((item) => item.id === eventId);
    const positions = [
      ...(event?.photos ?? []).map((photo) => photo.position),
      ...uploadsRef.current
        .filter((upload) => upload.eventId === eventId)
        .map((upload) => upload.position),
    ];
    const firstPosition = positions.length ? Math.max(...positions) + 1 : 0;
    setUploads((current) => [
      ...current,
      ...files.map((file, index) => {
        const clientUploadId = crypto.randomUUID();
        return {
          id: clientUploadId,
          eventId,
          file,
          clientUploadId,
          position: firstPosition + index,
          previewUrl: objectUrl(file),
          progress: 0,
          status: "queued" as const,
          error: null,
          rebaseOnRetry: false,
        };
      }),
    ]);
    return [];
  }

  function retry(id: string) {
    setUploads((current) =>
      (() => {
        const target = current.find(
          (upload) => upload.id === id && upload.status === "failed",
        );
        if (!target) return current;
        if (!target.rebaseOnRetry) {
          return current.map((upload) =>
            upload.id === id
              ? { ...upload, status: "queued" as const, error: null }
              : upload,
          );
        }

        const batch = current.filter(
          (upload) => upload.eventId === target.eventId && upload.rebaseOnRetry,
        );
        const batchIds = new Set(batch.map((upload) => upload.id));
        const occupiedPositions = [
          ...(eventsRef.current
            .find((event) => event.id === target.eventId)
            ?.photos.map((photo) => photo.position) ?? []),
          ...current
            .filter(
              (upload) =>
                upload.eventId === target.eventId && !batchIds.has(upload.id),
            )
            .map((upload) => upload.position),
        ];
        const firstPosition = occupiedPositions.length
          ? Math.max(...occupiedPositions) + 1
          : 0;
        const positions = new Map(
          batch.map((upload, index) => [upload.id, firstPosition + index]),
        );
        return current.map((upload) =>
          batchIds.has(upload.id)
            ? {
                ...upload,
                position: positions.get(upload.id) ?? upload.position,
                status: upload.id === id ? ("queued" as const) : upload.status,
                error: upload.id === id ? null : upload.error,
                rebaseOnRetry: false,
              }
            : upload,
        );
      })(),
    );
  }

  function remove(id: string) {
    const target = uploadsRef.current.find((upload) => upload.id === id);
    if (!target || target.status === "uploading") return;
    if (target.previewUrl) URL.revokeObjectURL(target.previewUrl);
    setUploads((current) => current.filter((upload) => upload.id !== id));
  }

  return { uploads, enqueue, retry, remove, occupied };
}

import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Button,
  Group,
  Image,
  Modal,
  Progress,
  SimpleGrid,
  Stack,
  Text,
} from "@mantine/core";

import {
  journalEventTypeLabels,
  type JournalEvent,
  type JournalPhoto,
} from "@/graphql/journalEvents";

import {
  acceptedPhotoTypesAttribute,
  maxJournalPhotos,
  validatePhotoSelection,
  type PhotoSelectionError,
} from "./journalPhotos";
import type { PendingPhoto } from "./useJournalPhotoUploads";

function previewUrl(file: File) {
  return typeof URL.createObjectURL === "function"
    ? URL.createObjectURL(file)
    : "";
}

function SelectedPhotoPreview({ file }: { file: File }) {
  const [url] = useState(() => previewUrl(file));
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  return url ? <Image alt="" h={64} radius="sm" src={url} w={64} /> : null;
}

export function JournalPhotoSelection({
  files,
  disabled,
  onChange,
}: {
  files: File[];
  disabled: boolean;
  onChange: (files: File[]) => void;
}) {
  const [errors, setErrors] = useState<PhotoSelectionError[]>([]);

  function select(selected: File[]) {
    const validation = validatePhotoSelection(selected, files.length);
    setErrors(validation);
    if (!validation.length) onChange([...files, ...selected]);
  }

  return (
    <Stack gap="xs">
      <Group justify="space-between" align="flex-end" wrap="wrap">
        <div>
          <Text fw={500}>Photos</Text>
          <Text c="dimmed" size="sm">
            {files.length} selected, {maxJournalPhotos - files.length} remaining
          </Text>
        </div>
        <Button
          component="label"
          disabled={disabled || files.length >= maxJournalPhotos}
          mih={44}
          variant="light"
        >
          Choose photos
          <input
            accept={acceptedPhotoTypesAttribute}
            aria-label="Choose Journal Event photos"
            disabled={disabled || files.length >= maxJournalPhotos}
            hidden
            multiple
            onChange={(event) => {
              select(Array.from(event.currentTarget.files ?? []));
              event.currentTarget.value = "";
            }}
            type="file"
          />
        </Button>
      </Group>
      {errors.length ? (
        <Alert color="red" role="alert" title="Some photos were not selected">
          {errors.map((error, index) => (
            <Text key={`${error.fileName ?? "selection"}-${index}`} size="sm">
              {error.fileName ? `${error.fileName}: ` : ""}
              {error.message}
            </Text>
          ))}
        </Alert>
      ) : null}
      {files.map((file, index) => (
        <Group key={`${file.name}-${file.lastModified}-${index}`} wrap="nowrap">
          <SelectedPhotoPreview file={file} />
          <Text lineClamp={2} style={{ flex: 1, minWidth: 0 }} size="sm">
            {file.name}
          </Text>
          <Button
            aria-label={`Remove selected photo ${file.name}`}
            disabled={disabled}
            mih={44}
            onClick={() => onChange(files.filter((_, item) => item !== index))}
            type="button"
            variant="subtle"
          >
            Remove
          </Button>
        </Group>
      ))}
    </Stack>
  );
}

export function AddJournalPhotos({
  disabled,
  remaining,
  onSelect,
}: {
  disabled: boolean;
  remaining: number;
  onSelect: (files: File[]) => PhotoSelectionError[];
}) {
  const [errors, setErrors] = useState<PhotoSelectionError[]>([]);
  return (
    <Stack gap={4}>
      <Group justify="space-between" wrap="wrap">
        <Text c="dimmed" size="sm">
          {remaining} photo{remaining === 1 ? "" : "s"} remaining
        </Text>
        <Button
          component="label"
          disabled={disabled || remaining === 0}
          mih={44}
          variant="light"
        >
          Add photos
          <input
            accept={acceptedPhotoTypesAttribute}
            aria-label="Add photos to Journal Event"
            disabled={disabled || remaining === 0}
            hidden
            multiple
            onChange={(event) => {
              setErrors(onSelect(Array.from(event.currentTarget.files ?? [])));
              event.currentTarget.value = "";
            }}
            type="file"
          />
        </Button>
      </Group>
      {errors.length ? (
        <Alert color="red" role="alert" title="Some photos were not selected">
          {errors.map((error, index) => (
            <Text key={`${error.fileName ?? "selection"}-${index}`} size="sm">
              {error.fileName ? `${error.fileName}: ` : ""}
              {error.message}
            </Text>
          ))}
        </Alert>
      ) : null}
    </Stack>
  );
}

export function PendingJournalPhotos({
  uploads,
  onRetry,
  onRemove,
}: {
  uploads: PendingPhoto[];
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  if (!uploads.length) return null;
  return (
    <Stack aria-label="Pending photo uploads" gap="xs">
      {uploads.some((upload) => upload.status === "failed") ? (
        <Alert
          color="yellow"
          title="The Journal Event was saved, but some photos need attention."
        >
          Retry or remove each failed photo below.
        </Alert>
      ) : null}
      {uploads.map((upload) => (
        <Group key={upload.id} align="flex-start" wrap="nowrap">
          {upload.previewUrl ? (
            <Image alt="" h={72} radius="sm" src={upload.previewUrl} w={72} />
          ) : null}
          <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
            <Text lineClamp={1} size="sm">
              {upload.file.name}
            </Text>
            {upload.status === "uploading" ? (
              <>
                <Progress
                  aria-label={`Uploading ${upload.file.name}`}
                  aria-valuetext={`${upload.progress}%`}
                  value={upload.progress}
                />
                <Text c="dimmed" role="status" size="xs">
                  Uploading {upload.progress}%
                </Text>
              </>
            ) : null}
            {upload.status === "queued" ? (
              <>
                <Text c="dimmed" role="status" size="xs">
                  Waiting to upload
                </Text>
                <Button
                  mih={44}
                  onClick={() => onRemove(upload.id)}
                  size="xs"
                  variant="default"
                >
                  Remove
                </Button>
              </>
            ) : null}
            {upload.error ? (
              <Text c="red" role="alert" size="sm">
                {upload.error}
              </Text>
            ) : null}
            {upload.status === "failed" ? (
              <Group gap="xs">
                <Button
                  aria-label={`Retry ${upload.file.name}`}
                  mih={44}
                  onClick={() => onRetry(upload.id)}
                  size="xs"
                >
                  Retry
                </Button>
                <Button
                  aria-label={`Remove failed photo ${upload.file.name}`}
                  mih={44}
                  onClick={() => onRemove(upload.id)}
                  size="xs"
                  variant="default"
                >
                  Remove
                </Button>
              </Group>
            ) : null}
          </Stack>
        </Group>
      ))}
    </Stack>
  );
}

function photoAlt(event: JournalEvent, photo: JournalPhoto) {
  return `${journalEventTypeLabels[event.eventType]} on ${event.eventDate}: ${photo.originalFilename}`;
}

export function JournalPhotoGallery({
  event,
  active,
  deletingPhotoId,
  onDelete,
  onImageError,
}: {
  event: JournalEvent;
  active: boolean;
  deletingPhotoId: string | null;
  onDelete: (photo: JournalPhoto, origin: HTMLElement) => void;
  onImageError: () => void;
}) {
  const [lightboxPhotoId, setLightboxPhotoId] = useState<string | null>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const failedUrls = useRef(new Set<string>());
  const lightboxPhoto =
    event.photos.find((photo) => photo.id === lightboxPhotoId) ?? null;

  function handleError(url: string) {
    if (failedUrls.current.has(url)) return;
    failedUrls.current.add(url);
    onImageError();
  }

  if (!event.photos.length) return null;
  return (
    <>
      <SimpleGrid
        aria-label="Journal Event photos"
        cols={{ base: 2, sm: 3, md: 4 }}
        role="list"
        spacing="xs"
      >
        {event.photos.map((photo) => (
          <Stack gap={4} key={photo.id} role="listitem">
            <button
              aria-label={`Open ${photoAlt(event, photo)}`}
              onClick={(clickEvent) => {
                trigger.current = clickEvent.currentTarget;
                setLightboxPhotoId(photo.id);
              }}
              style={{
                background: "none",
                border: 0,
                cursor: "pointer",
                minHeight: 44,
                padding: 0,
              }}
              type="button"
            >
              <Image
                alt={photoAlt(event, photo)}
                fallbackSrc="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="
                fit="cover"
                loading="lazy"
                onError={() => handleError(photo.thumbnailUrl)}
                radius="sm"
                src={photo.thumbnailUrl}
                style={{ aspectRatio: 1 }}
                w="100%"
              />
            </button>
            {active ? (
              <Button
                aria-label={`Remove photo ${photo.originalFilename}`}
                color="red"
                loading={deletingPhotoId === photo.id}
                mih={44}
                onClick={(clickEvent) =>
                  onDelete(photo, clickEvent.currentTarget)
                }
                size="xs"
                variant="subtle"
              >
                Remove
              </Button>
            ) : null}
          </Stack>
        ))}
      </SimpleGrid>
      <Modal
        centered
        onClose={() => setLightboxPhotoId(null)}
        onExitTransitionEnd={() => trigger.current?.focus()}
        opened={lightboxPhoto !== null}
        size="xl"
        title={lightboxPhoto?.originalFilename ?? "Journal photo"}
        transitionProps={{ duration: 0 }}
      >
        {lightboxPhoto ? (
          <Image
            alt={photoAlt(event, lightboxPhoto)}
            fit="contain"
            mah="75vh"
            onError={() => handleError(lightboxPhoto.fullSizeUrl)}
            src={lightboxPhoto.fullSizeUrl}
            w="100%"
          />
        ) : null}
      </Modal>
    </>
  );
}

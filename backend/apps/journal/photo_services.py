import io
import logging
import os
import uuid
import warnings
from dataclasses import dataclass

from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile
from django.db import IntegrityError, transaction
from PIL import Image, ImageOps, UnidentifiedImageError

from apps.growing_trials.models import GrowingTrial, GrowingTrialStatus
from apps.journal.models import JournalEvent, JournalPhoto
from apps.journal.photo_storage import delete_photo_objects, get_photo_storage

MAX_PHOTOS_PER_EVENT = 5
MAX_PHOTO_UPLOAD_SIZE = 10 * 1024 * 1024
MAX_DECODED_PIXELS = 40_000_000
THUMBNAIL_MAX_SIZE = (512, 512)

INVALID_PHOTO_REQUEST = 'INVALID_PHOTO_REQUEST'
JOURNAL_EVENT_NOT_FOUND = 'JOURNAL_EVENT_NOT_FOUND'
JOURNAL_PHOTO_NOT_FOUND = 'JOURNAL_PHOTO_NOT_FOUND'
GROWING_TRIAL_NOT_ACTIVE = 'GROWING_TRIAL_NOT_ACTIVE'
PHOTO_LIMIT_REACHED = 'PHOTO_LIMIT_REACHED'
PHOTO_TOO_LARGE = 'PHOTO_TOO_LARGE'
UNSUPPORTED_PHOTO_TYPE = 'UNSUPPORTED_PHOTO_TYPE'
INVALID_PHOTO = 'INVALID_PHOTO'
PHOTO_POSITION_CONFLICT = 'PHOTO_POSITION_CONFLICT'
PHOTO_STORAGE_FAILED = 'PHOTO_STORAGE_FAILED'

logger = logging.getLogger(__name__)


class JournalPhotoError(Exception):
    def __init__(self, code: str, message: str):
        self.code = code
        super().__init__(message)


@dataclass(frozen=True)
class ProcessedPhoto:
    full: bytes
    thumbnail: bytes
    extension: str
    content_type: str
    width: int
    height: int


def _error(code: str, message: str) -> JournalPhotoError:
    return JournalPhotoError(code, message)


def _read_upload(upload) -> bytes:
    if getattr(upload, 'size', 0) > MAX_PHOTO_UPLOAD_SIZE:
        raise _error(PHOTO_TOO_LARGE, 'Photo must be 10 MB or smaller.')
    data = upload.read(MAX_PHOTO_UPLOAD_SIZE + 1)
    if len(data) > MAX_PHOTO_UPLOAD_SIZE:
        raise _error(PHOTO_TOO_LARGE, 'Photo must be 10 MB or smaller.')
    if not data:
        raise _error(INVALID_PHOTO, 'Photo could not be decoded safely.')
    return data


def _metadata_free_image(image: Image.Image, output_format: str) -> Image.Image:
    has_alpha = image.mode in {'RGBA', 'LA'} or (
        image.mode == 'P' and 'transparency' in image.info
    )
    if output_format == 'JPEG':
        image = image.convert('RGB')
    elif has_alpha:
        image = image.convert('RGBA')
    else:
        image = image.convert('RGB')
    clean = Image.new(image.mode, image.size)
    clean.paste(image)
    return clean


def process_photo_upload(upload) -> tuple[ProcessedPhoto, int]:
    data = _read_upload(upload)
    original_size = len(data)
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(data)) as decoded:
                if decoded.format not in {'JPEG', 'PNG', 'WEBP'}:
                    raise _error(
                        UNSUPPORTED_PHOTO_TYPE,
                        'Photo must be a JPEG, PNG, or WebP image.',
                    )
                if decoded.width * decoded.height > MAX_DECODED_PIXELS:
                    raise _error(
                        INVALID_PHOTO, 'Photo exceeds the decoded pixel limit.'
                    )
                decoded.seek(0)
                decoded.load()
                oriented = ImageOps.exif_transpose(decoded)
                output_format = decoded.format
                clean = _metadata_free_image(oriented, output_format)
    except JournalPhotoError:
        raise
    except UnidentifiedImageError as exc:
        raise _error(
            UNSUPPORTED_PHOTO_TYPE,
            'Photo must be a JPEG, PNG, or WebP image.',
        ) from exc
    except (Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
        raise _error(INVALID_PHOTO, 'Photo exceeds the decoded pixel limit.') from exc
    except (OSError, SyntaxError, ValueError) as exc:
        raise _error(INVALID_PHOTO, 'Photo could not be decoded safely.') from exc

    formats = {
        'JPEG': ('jpg', 'image/jpeg'),
        'PNG': ('png', 'image/png'),
        'WEBP': ('webp', 'image/webp'),
    }
    extension, content_type = formats[output_format]
    full_buffer = io.BytesIO()
    save_options = {'quality': 90} if output_format in {'JPEG', 'WEBP'} else {}
    clean.save(full_buffer, output_format, **save_options)

    thumbnail = clean.copy()
    thumbnail.thumbnail(THUMBNAIL_MAX_SIZE, Image.Resampling.LANCZOS)
    thumbnail_buffer = io.BytesIO()
    thumbnail.save(thumbnail_buffer, 'WEBP', quality=82)
    return (
        ProcessedPhoto(
            full=full_buffer.getvalue(),
            thumbnail=thumbnail_buffer.getvalue(),
            extension=extension,
            content_type=content_type,
            width=clean.width,
            height=clean.height,
        ),
        original_size,
    )


def _event_trial_id(event_id: object) -> int:
    try:
        return JournalEvent.objects.values_list('growing_trial_id', flat=True).get(
            pk=event_id
        )
    except (JournalEvent.DoesNotExist, TypeError, ValueError, ValidationError) as exc:
        raise _error(JOURNAL_EVENT_NOT_FOUND, 'Journal Event not found.') from exc


def _photo_context_ids(photo_id: object) -> tuple[int, int]:
    try:
        return JournalPhoto.objects.values_list(
            'journal_event_id', 'journal_event__growing_trial_id'
        ).get(pk=photo_id)
    except (JournalPhoto.DoesNotExist, TypeError, ValueError, ValidationError) as exc:
        raise _error(JOURNAL_PHOTO_NOT_FOUND, 'Journal Photo not found.') from exc


def _validate_active(trial: GrowingTrial) -> None:
    if trial.status != GrowingTrialStatus.ACTIVE:
        raise _error(
            GROWING_TRIAL_NOT_ACTIVE,
            'Photos can only be changed for active Growing Trials.',
        )


def create_journal_photo(
    *, event_id: object, upload, client_upload_id: uuid.UUID, position: int
) -> tuple[JournalPhoto, bool]:
    trial_id = _event_trial_id(event_id)
    saved_keys: list[str] = []
    try:
        with transaction.atomic():
            try:
                trial = GrowingTrial.objects.select_for_update().get(pk=trial_id)
                event = JournalEvent.objects.select_for_update().get(pk=event_id)
            except (GrowingTrial.DoesNotExist, JournalEvent.DoesNotExist) as exc:
                raise _error(
                    JOURNAL_EVENT_NOT_FOUND, 'Journal Event not found.'
                ) from exc
            existing = JournalPhoto.objects.filter(
                journal_event=event, client_upload_id=client_upload_id
            ).first()
            if existing is not None:
                return existing, False
            _validate_active(trial)
            if (
                JournalPhoto.objects.filter(journal_event=event).count()
                >= MAX_PHOTOS_PER_EVENT
            ):
                raise _error(
                    PHOTO_LIMIT_REACHED,
                    'Journal Events can have up to 5 photos.',
                )
            if JournalPhoto.objects.filter(
                journal_event=event, position=position
            ).exists():
                raise _error(
                    PHOTO_POSITION_CONFLICT,
                    'Photo position is already in use; refresh and try again.',
                )

            processed, original_size = process_photo_upload(upload)
            photo = JournalPhoto.objects.create(
                journal_event=event,
                full_object_key='',
                thumbnail_object_key='',
                original_filename=os.path.basename(upload.name)[:255],
                content_type=processed.content_type,
                file_size=len(processed.full),
                original_upload_size=original_size,
                width=processed.width,
                height=processed.height,
                position=position,
                client_upload_id=client_upload_id,
            )
            prefix = f'journal-events/{event.pk}/{photo.pk}'
            storage = get_photo_storage()
            try:
                full_key = storage.save(
                    f'{prefix}/full.{processed.extension}',
                    ContentFile(processed.full),
                )
                saved_keys.append(full_key)
                thumbnail_key = storage.save(
                    f'{prefix}/thumbnail.webp',
                    ContentFile(processed.thumbnail),
                )
                saved_keys.append(thumbnail_key)
            except Exception as exc:
                raise _error(
                    PHOTO_STORAGE_FAILED,
                    'Photo storage is temporarily unavailable.',
                ) from exc
            photo.full_object_key = full_key
            photo.thumbnail_object_key = thumbnail_key
            photo.save(
                update_fields=['full_object_key', 'thumbnail_object_key', 'updated_at']
            )
        return photo, True
    except JournalPhotoError:
        if saved_keys:
            delete_photo_objects(saved_keys, raise_errors=False)
        raise
    except IntegrityError as exc:
        if saved_keys:
            delete_photo_objects(saved_keys, raise_errors=False)
        raise _error(
            PHOTO_POSITION_CONFLICT,
            'Photo position is already in use; refresh and try again.',
        ) from exc
    except Exception:
        if saved_keys:
            delete_photo_objects(saved_keys, raise_errors=False)
        raise


def delete_journal_photo(*, photo_id: object) -> bool:
    event_id, trial_id = _photo_context_ids(photo_id)
    with transaction.atomic():
        try:
            trial = GrowingTrial.objects.select_for_update().get(pk=trial_id)
            JournalEvent.objects.select_for_update().get(pk=event_id)
            photo = JournalPhoto.objects.select_for_update().get(pk=photo_id)
        except (
            GrowingTrial.DoesNotExist,
            JournalEvent.DoesNotExist,
            JournalPhoto.DoesNotExist,
        ) as exc:
            raise _error(JOURNAL_PHOTO_NOT_FOUND, 'Journal Photo not found.') from exc
        _validate_active(trial)
        try:
            delete_photo_objects(
                [photo.full_object_key, photo.thumbnail_object_key],
                raise_errors=True,
            )
        except Exception as exc:
            raise _error(
                PHOTO_STORAGE_FAILED,
                'Photo storage is temporarily unavailable.',
            ) from exc
        photo.delete()
    return True


def cleanup_event_photo_objects(event: JournalEvent) -> None:
    for photo in event.photos.all().only('full_object_key', 'thumbnail_object_key'):
        delete_photo_objects(
            [photo.full_object_key, photo.thumbnail_object_key],
            raise_errors=False,
        )

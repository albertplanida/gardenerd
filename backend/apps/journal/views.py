import logging
import uuid

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

from apps.journal.photo_services import (
    GROWING_TRIAL_NOT_ACTIVE,
    INVALID_PHOTO,
    INVALID_PHOTO_REQUEST,
    JOURNAL_EVENT_NOT_FOUND,
    MAX_PHOTO_UPLOAD_SIZE,
    PHOTO_LIMIT_REACHED,
    PHOTO_POSITION_CONFLICT,
    PHOTO_STORAGE_FAILED,
    PHOTO_TOO_LARGE,
    UNSUPPORTED_PHOTO_TYPE,
    JournalPhotoError,
    create_journal_photo,
)
from apps.journal.photo_storage import photo_url

logger = logging.getLogger(__name__)


def serialize_photo(photo) -> dict:
    return {
        'id': str(photo.pk),
        'originalFilename': photo.original_filename,
        'contentType': photo.content_type,
        'fileSize': photo.file_size,
        'originalUploadSize': photo.original_upload_size,
        'width': photo.width,
        'height': photo.height,
        'position': photo.position,
        'thumbnailUrl': photo_url(photo.thumbnail_object_key),
        'fullSizeUrl': photo_url(photo.full_object_key),
        'createdAt': photo.created_at.isoformat(),
        'updatedAt': photo.updated_at.isoformat(),
    }


def _error_response(code: str, message: str, status: int) -> JsonResponse:
    return JsonResponse({'error': {'code': code, 'message': message}}, status=status)


@csrf_exempt
def upload_journal_photo(request, event_id: int):
    if request.method != 'POST':
        return _error_response(
            INVALID_PHOTO_REQUEST, 'Only POST requests are supported.', 405
        )
    try:
        content_length = int(request.META.get('CONTENT_LENGTH', 0))
    except (TypeError, ValueError):
        content_length = 0
    if content_length > MAX_PHOTO_UPLOAD_SIZE + 1024 * 1024:
        return _error_response(PHOTO_TOO_LARGE, 'Photo must be 10 MB or smaller.', 413)

    upload = request.FILES.get('photo')
    try:
        client_upload_id = uuid.UUID(request.POST.get('clientUploadId', ''))
        position = int(request.POST.get('position', ''))
        if upload is None or position < 0:
            raise (ValueError('missing photo or negative position'))
    except (TypeError, ValueError, AttributeError):
        return _error_response(
            INVALID_PHOTO_REQUEST,
            'photo, clientUploadId, and a nonnegative integer position are required.',
            400,
        )

    try:
        photo, created = create_journal_photo(
            event_id=event_id,
            upload=upload,
            client_upload_id=client_upload_id,
            position=position,
        )
        return JsonResponse(
            {'photo': serialize_photo(photo)}, status=201 if created else 200
        )
    except JournalPhotoError as exc:
        statuses = {
            JOURNAL_EVENT_NOT_FOUND: 404,
            GROWING_TRIAL_NOT_ACTIVE: 409,
            PHOTO_LIMIT_REACHED: 409,
            PHOTO_POSITION_CONFLICT: 409,
            PHOTO_TOO_LARGE: 413,
            UNSUPPORTED_PHOTO_TYPE: 415,
            INVALID_PHOTO: 400,
            PHOTO_STORAGE_FAILED: 503,
        }
        return _error_response(exc.code, str(exc), statuses.get(exc.code, 400))
    except Exception:
        logger.exception(
            'Unexpected error uploading photo for Journal Event %s', event_id
        )
        return _error_response('INTERNAL_ERROR', 'Internal server error.', 500)

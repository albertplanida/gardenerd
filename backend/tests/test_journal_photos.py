import io
import os
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from threading import Barrier
from unittest.mock import Mock

import pytest
from django.core.files.storage import storages
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import IntegrityError, connection, connections
from django.test.utils import CaptureQueriesContext
from PIL import Image
from storages.backends.s3 import S3Storage

from apps.containers.models import Container
from apps.growing_trials.models import (
    GrowingTrial,
    GrowingTrialStartMethod,
    GrowingTrialStatus,
)
from apps.journal.models import JournalEvent, JournalEventEventType, JournalPhoto
from apps.journal.photo_services import (
    GROWING_TRIAL_NOT_ACTIVE,
    INVALID_PHOTO,
    JOURNAL_PHOTO_NOT_FOUND,
    PHOTO_LIMIT_REACHED,
    PHOTO_POSITION_CONFLICT,
    PHOTO_STORAGE_FAILED,
    PHOTO_TOO_LARGE,
    UNSUPPORTED_PHOTO_TYPE,
    JournalPhotoError,
    create_journal_photo,
    delete_journal_photo,
    process_photo_upload,
)
from apps.plants.models import Plant


@pytest.fixture(autouse=True)
def in_memory_photo_storage(settings):
    settings.STORAGES = {
        'default': {'BACKEND': 'django.core.files.storage.InMemoryStorage'},
        'staticfiles': {
            'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage'
        },
    }
    storages._storages.clear()
    yield
    storages._storages.clear()


def _active_event():
    trial = GrowingTrial.objects.create(
        plant=Plant.objects.create(name='Radish'),
        container=Container.objects.create(name='Pot'),
        status=GrowingTrialStatus.ACTIVE,
        start_date=date.today(),
        start_method=GrowingTrialStartMethod.SEED,
    )
    return JournalEvent.objects.create(
        growing_trial=trial,
        event_type=JournalEventEventType.PHOTO_TAKEN,
        event_date=date.today(),
        note='Growth update',
    )


@pytest.fixture
def event():
    return _active_event()


def image_upload(image_format='JPEG', *, size=(32, 20), name=None, save_options=None):
    buffer = io.BytesIO()
    mode = 'RGBA' if image_format in {'PNG', 'WEBP'} else 'RGB'
    Image.new(mode, size, (12, 80, 140, 128) if mode == 'RGBA' else (12, 80, 140)).save(
        buffer, image_format, **(save_options or {})
    )
    extension = {'JPEG': 'jpg', 'PNG': 'png', 'WEBP': 'webp'}[image_format]
    return SimpleUploadedFile(name or f'photo.{extension}', buffer.getvalue())


def post_photo(client, event, upload, *, upload_id=None, position='0'):
    return client.post(
        f'/api/journal-events/{event.pk}/photos/',
        {
            'photo': upload,
            'clientUploadId': str(upload_id or uuid.uuid4()),
            'position': position,
        },
    )


@pytest.mark.django_db
@pytest.mark.parametrize(
    ('image_format', 'content_type', 'extension'),
    [
        ('JPEG', 'image/jpeg', 'jpg'),
        ('PNG', 'image/png', 'png'),
        ('WEBP', 'image/webp', 'webp'),
    ],
)
def test_upload_accepts_formats_and_returns_complete_envelope(
    client, event, image_format, content_type, extension
):
    response = post_photo(client, event, image_upload(image_format), position='7')
    payload = response.json()['photo']
    photo = JournalPhoto.objects.get()

    assert response.status_code == 201
    assert payload['id'] == str(photo.pk)
    assert payload['contentType'] == content_type
    assert payload['position'] == 7
    assert payload['fileSize'] == photo.file_size
    assert payload['originalUploadSize'] == photo.original_upload_size
    assert payload['thumbnailUrl'].endswith('/thumbnail.webp')
    assert payload['fullSizeUrl'].endswith(f'/full.{extension}')
    assert photo.full_object_key == (
        f'journal-events/{event.pk}/{photo.pk}/full.{extension}'
    )
    storage = storages['default']
    with storage.open(photo.full_object_key) as stored:
        with Image.open(stored) as full:
            assert full.format == image_format
            assert full.size == (32, 20)
    with storage.open(photo.thumbnail_object_key) as stored:
        with Image.open(stored) as thumbnail:
            assert thumbnail.format == 'WEBP'
            assert thumbnail.size == (32, 20)


def test_processing_orients_strips_metadata_and_bounds_thumbnail():
    exif = Image.Exif()
    exif[274] = 6
    exif[270] = 'private metadata'
    upload = image_upload(
        'JPEG', size=(800, 400), save_options={'exif': exif, 'icc_profile': b'private'}
    )

    processed, original_size = process_photo_upload(upload)

    assert original_size == upload.size
    assert (processed.width, processed.height) == (400, 800)
    with Image.open(io.BytesIO(processed.full)) as full:
        assert full.format == 'JPEG'
        assert full.size == (400, 800)
        assert not full.getexif()
        assert 'icc_profile' not in full.info
    with Image.open(io.BytesIO(processed.thumbnail)) as thumbnail:
        assert thumbnail.size == (256, 512)


def test_processing_flattens_animated_webp_to_first_frame():
    buffer = io.BytesIO()
    frames = [Image.new('RGB', (30, 20), color) for color in ('red', 'blue')]
    frames[0].save(buffer, 'WEBP', save_all=True, append_images=frames[1:], duration=50)

    processed, _ = process_photo_upload(
        SimpleUploadedFile('animated.webp', buffer.getvalue())
    )

    with Image.open(io.BytesIO(processed.full)) as full:
        assert full.n_frames == 1
        assert full.getpixel((0, 0))[0] > full.getpixel((0, 0))[2]


@pytest.mark.django_db
@pytest.mark.parametrize(
    ('data', 'expected_code', 'expected_status'),
    [
        (b'<svg xmlns="http://www.w3.org/2000/svg"/>', UNSUPPORTED_PHOTO_TYPE, 415),
        (b'not an image', UNSUPPORTED_PHOTO_TYPE, 415),
        (b'', INVALID_PHOTO, 400),
    ],
)
def test_upload_rejects_unsupported_corrupt_and_empty_files(
    client, event, data, expected_code, expected_status
):
    response = post_photo(client, event, SimpleUploadedFile('spoof.jpg', data))

    assert response.status_code == expected_status
    assert response.json()['error']['code'] == expected_code
    assert not JournalPhoto.objects.exists()


@pytest.mark.django_db
def test_upload_rejects_oversize_before_decoding(client, event):
    response = post_photo(
        client, event, SimpleUploadedFile('large.jpg', b'x' * (10 * 1024 * 1024 + 1))
    )

    assert response.status_code == 413
    assert response.json()['error']['code'] == PHOTO_TOO_LARGE


def test_processing_rejects_corrupt_recognized_image():
    valid = image_upload().read()
    with pytest.raises(JournalPhotoError) as error:
        process_photo_upload(SimpleUploadedFile('truncated.jpg', valid[:30]))

    assert error.value.code == INVALID_PHOTO


def test_processing_enforces_decoded_pixel_limit(monkeypatch):
    monkeypatch.setattr('apps.journal.photo_services.MAX_DECODED_PIXELS', 10)

    with pytest.raises(JournalPhotoError) as error:
        process_photo_upload(image_upload(size=(4, 3)))

    assert error.value.code == INVALID_PHOTO


@pytest.mark.django_db
def test_upload_uses_decoded_format_instead_of_name_or_submitted_mime(client, event):
    png = image_upload('PNG', name='spoof.jpg')
    png.content_type = 'image/jpeg'

    response = post_photo(client, event, png)

    assert response.status_code == 201
    assert response.json()['photo']['contentType'] == 'image/png'
    assert response.json()['photo']['fullSizeUrl'].endswith('/full.png')


@pytest.mark.django_db
@pytest.mark.parametrize(
    'fields',
    [
        {},
        {'clientUploadId': 'not-a-uuid', 'position': '0'},
        {'clientUploadId': str(uuid.uuid4()), 'position': '-1'},
        {'clientUploadId': str(uuid.uuid4()), 'position': '1.5'},
    ],
)
def test_malformed_fields_use_stable_error_envelope(client, event, fields):
    fields.setdefault('photo', image_upload())
    response = client.post(f'/api/journal-events/{event.pk}/photos/', fields)

    assert response.status_code == 400
    assert response.json()['error']['code'] == 'INVALID_PHOTO_REQUEST'


@pytest.mark.django_db
def test_upload_is_csrf_exempt_and_non_post_uses_json_envelope(client, event):
    client.enforce_csrf_checks = True
    upload = post_photo(client, event, image_upload())
    method_error = client.get(f'/api/journal-events/{event.pk}/photos/')

    assert upload.status_code == 201
    assert method_error.status_code == 405
    assert method_error.json()['error']['code'] == 'INVALID_PHOTO_REQUEST'


@pytest.mark.django_db
def test_successful_idempotency_replays_after_terminal_transition(client, event):
    upload_id = uuid.uuid4()
    created = post_photo(
        client, event, image_upload(), upload_id=upload_id, position='3'
    )
    GrowingTrial.objects.filter(pk=event.growing_trial_id).update(
        status=GrowingTrialStatus.COMPLETED, end_date=date.today()
    )
    replayed = post_photo(
        client, event, image_upload('PNG'), upload_id=upload_id, position='99'
    )

    assert created.status_code == 201
    assert replayed.status_code == 200
    assert replayed.json()['photo']['id'] == created.json()['photo']['id']
    assert replayed.json()['photo']['position'] == 3
    assert JournalPhoto.objects.count() == 1


@pytest.mark.django_db
def test_new_upload_rejects_terminal_trial(client, event):
    GrowingTrial.objects.filter(pk=event.growing_trial_id).update(
        status=GrowingTrialStatus.ABANDONED, end_date=date.today()
    )

    response = post_photo(client, event, image_upload())

    assert response.status_code == 409
    assert response.json()['error']['code'] == GROWING_TRIAL_NOT_ACTIVE


def stored_photo(event, position, upload_id=None):
    return JournalPhoto.objects.create(
        journal_event=event,
        full_object_key=f'full-{position}',
        thumbnail_object_key=f'thumb-{position}',
        original_filename='photo.jpg',
        content_type='image/jpeg',
        file_size=100,
        original_upload_size=120,
        width=10,
        height=10,
        position=position,
        client_upload_id=upload_id or uuid.uuid4(),
    )


def _require_postgresql():
    if connection.vendor == 'postgresql':
        return
    if os.environ.get('REQUIRE_POSTGRES') == '1':
        pytest.fail(f'PostgreSQL required, connected to {connection.vendor}')
    pytest.skip('PostgreSQL row-lock behavior only')


@pytest.mark.django_db
def test_positions_allow_gaps_but_enforce_conflicts_and_limit(client, event):
    stored_photo(event, 10)
    conflict = post_photo(client, event, image_upload(), position='10')
    for position in [20, 30, 40, 50]:
        stored_photo(event, position)
    limited = post_photo(client, event, image_upload(), position='60')

    assert conflict.status_code == 409
    assert conflict.json()['error']['code'] == PHOTO_POSITION_CONFLICT
    assert limited.status_code == 409
    assert limited.json()['error']['code'] == PHOTO_LIMIT_REACHED


@pytest.mark.django_db(transaction=True)
def test_postgresql_concurrent_uploads_enforce_five_photo_limit():
    _require_postgresql()
    event = _active_event()
    for position in range(4):
        stored_photo(event, position)
    barrier = Barrier(2)

    def upload(position):
        connections.close_all()
        barrier.wait()
        try:
            create_journal_photo(
                event_id=event.pk,
                upload=image_upload(name=f'photo-{position}.jpg'),
                client_upload_id=uuid.uuid4(),
                position=position,
            )
            return 'created'
        except JournalPhotoError as error:
            return error.code
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = [executor.submit(upload, position) for position in (4, 5)]

    assert sorted(result.result() for result in results) == [
        PHOTO_LIMIT_REACHED,
        'created',
    ]
    assert JournalPhoto.objects.filter(journal_event=event).count() == 5


@pytest.mark.django_db
def test_model_constraints_position_and_client_upload_id(event):
    photo = stored_photo(event, 0)
    with pytest.raises(IntegrityError):
        with connection.cursor():
            JournalPhoto.objects.create(
                journal_event=event,
                full_object_key='full',
                thumbnail_object_key='thumb',
                original_filename='photo.jpg',
                content_type='image/jpeg',
                file_size=1,
                original_upload_size=1,
                width=1,
                height=1,
                position=1,
                client_upload_id=photo.client_upload_id,
            )


@pytest.mark.django_db
def test_storage_write_failure_cleans_partial_object_and_metadata(event, monkeypatch):
    storage = storages['default']
    real_save = storage.save
    calls = 0

    def fail_second_save(name, content, max_length=None):
        nonlocal calls
        calls += 1
        if calls == 2:
            raise OSError('provider secret')
        return real_save(name, content, max_length=max_length)

    monkeypatch.setattr(storage, 'save', fail_second_save)

    with pytest.raises(JournalPhotoError) as error:
        create_journal_photo(
            event_id=event.pk,
            upload=image_upload(),
            client_upload_id=uuid.uuid4(),
            position=0,
        )

    assert error.value.code == PHOTO_STORAGE_FAILED
    assert not JournalPhoto.objects.exists()
    assert not storage.exists(f'journal-events/{event.pk}/1/full.jpg')


@pytest.mark.django_db
def test_database_failure_after_writes_cleans_both_objects(event, monkeypatch):
    real_save = JournalPhoto.save
    calls = 0

    def fail_metadata_update(self, *args, **kwargs):
        nonlocal calls
        calls += 1
        if calls == 2:
            raise RuntimeError('database failed')
        return real_save(self, *args, **kwargs)

    monkeypatch.setattr(JournalPhoto, 'save', fail_metadata_update)

    with pytest.raises(RuntimeError, match='database failed'):
        create_journal_photo(
            event_id=event.pk,
            upload=image_upload(),
            client_upload_id=uuid.uuid4(),
            position=0,
        )

    storage = storages['default']
    assert not JournalPhoto.objects.exists()
    assert not storage.exists(f'journal-events/{event.pk}/1/full.jpg')
    assert not storage.exists(f'journal-events/{event.pk}/1/thumbnail.webp')


@pytest.mark.django_db
def test_direct_delete_failure_keeps_row_for_retry(event, monkeypatch):
    photo = stored_photo(event, 0)
    monkeypatch.setattr(
        'apps.journal.photo_services.delete_photo_objects',
        Mock(side_effect=OSError('provider secret')),
    )

    with pytest.raises(JournalPhotoError) as error:
        delete_journal_photo(photo_id=photo.pk)

    assert error.value.code == PHOTO_STORAGE_FAILED
    assert JournalPhoto.objects.filter(pk=photo.pk).exists()


@pytest.mark.django_db
def test_delete_missing_uses_photo_not_found():
    with pytest.raises(JournalPhotoError) as error:
        delete_journal_photo(photo_id='missing')

    assert error.value.code == JOURNAL_PHOTO_NOT_FOUND


@pytest.mark.django_db
def test_event_delete_proceeds_when_storage_cleanup_fails(
    event, monkeypatch, caplog, django_capture_on_commit_callbacks
):
    stored_photo(event, 0)
    monkeypatch.setattr(
        'apps.journal.photo_storage.get_photo_storage',
        Mock(return_value=Mock(delete=Mock(side_effect=OSError('cleanup failed')))),
    )

    with django_capture_on_commit_callbacks(execute=True):
        event.delete()

    assert not JournalEvent.objects.filter(pk=event.pk).exists()
    assert not JournalPhoto.objects.exists()
    assert 'cleanup failed' in caplog.text


@pytest.mark.django_db
def test_growing_trial_cascade_removes_photo_objects(
    event, django_capture_on_commit_callbacks
):
    storage = storages['default']
    storage.save('full', io.BytesIO(b'full'))
    storage.save('thumb', io.BytesIO(b'thumb'))
    stored_photo(event, 0).journal_event.photos.update(
        full_object_key='full', thumbnail_object_key='thumb'
    )

    with django_capture_on_commit_callbacks(execute=True):
        event.growing_trial.delete()

    assert not JournalEvent.objects.exists()
    assert not JournalPhoto.objects.exists()
    assert not storage.exists('full')
    assert not storage.exists('thumb')


@pytest.mark.django_db
def test_graphql_timeline_prefetches_ordered_photos_without_query_growth(client, event):
    stored_photo(event, 8)
    stored_photo(event, 2)
    second_event = JournalEvent.objects.create(
        growing_trial=event.growing_trial,
        event_type=JournalEventEventType.WATERED,
        event_date=date.today(),
        note='Second',
    )
    stored_photo(second_event, 0)
    query = """
        query($id: ID!) {
          journalEvents(growingTrialId: $id) {
            items { id photos { id position fullSizeUrl thumbnailUrl } }
          }
        }
    """

    with CaptureQueriesContext(connection) as queries:
        response = client.post(
            '/graphql/',
            data={'query': query, 'variables': {'id': str(event.growing_trial_id)}},
            content_type='application/json',
        )

    assert response.status_code == 200
    assert 'errors' not in response.json()
    photos = next(
        item['photos']
        for item in response.json()['data']['journalEvents']['items']
        if item['id'] == str(event.pk)
    )
    assert [photo['position'] for photo in photos] == [2, 8]
    assert len(queries) == 3


@pytest.mark.django_db
def test_graphql_delete_exposes_stable_errors(client):
    response = client.post(
        '/graphql/',
        data={
            'query': 'mutation($id: ID!) { deleteJournalPhoto(id: $id) }',
            'variables': {'id': 'missing'},
        },
        content_type='application/json',
    )

    error = response.json()['errors'][0]
    assert error['extensions']['code'] == JOURNAL_PHOTO_NOT_FOUND


def test_r2_storage_generates_private_expiring_signed_url():
    storage = S3Storage(
        access_key='access',
        secret_key='secret',
        bucket_name='private-bucket',
        endpoint_url='https://account.r2.cloudflarestorage.com',
        querystring_auth=True,
        querystring_expire=3600,
    )
    client = Mock()
    client.generate_presigned_url.return_value = 'https://signed.example/photo'
    storage._connections.connection = Mock(meta=Mock(client=client))
    bucket = Mock()
    bucket.name = 'private-bucket'
    storage._bucket = bucket

    assert storage.url('journal-events/1/2/full.jpg') == (
        'https://signed.example/photo'
    )
    client.generate_presigned_url.assert_called_once_with(
        'get_object',
        Params={'Bucket': 'private-bucket', 'Key': 'journal-events/1/2/full.jpg'},
        ExpiresIn=3600,
        HttpMethod=None,
    )

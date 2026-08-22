from datetime import date

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction

from apps.containers.models import Container
from apps.growing_trials.models import (
    GrowingTrial,
    GrowingTrialStartMethod,
    GrowingTrialStatus,
)
from apps.journal.models import (
    INVALID_JOURNAL_NOTE_MESSAGE,
    JournalEvent,
    JournalEventEventType,
)
from apps.plants.models import Plant


@pytest.fixture
def trial():
    return GrowingTrial.objects.create(
        plant=Plant.objects.create(name='Radish'),
        container=Container.objects.create(name='Pot 1'),
        status=GrowingTrialStatus.ACTIVE,
        start_date=date(2026, 8, 1),
        start_method=GrowingTrialStartMethod.SEED,
    )


@pytest.mark.django_db
@pytest.mark.parametrize('event_type', JournalEventEventType.values)
def test_journal_event_persists_every_supported_type(trial, event_type):
    event = JournalEvent.objects.create(
        growing_trial=trial,
        event_type=event_type,
        event_date=date(2026, 8, 2),
        note='Healthy growth',
    )

    assert event.event_type == event_type
    assert event.created_at is not None
    assert event.updated_at is not None


@pytest.mark.django_db
@pytest.mark.parametrize('note', ['', ' \n\t ', 'x' * 5001, None, 123])
def test_journal_event_rejects_invalid_notes(trial, note):
    with pytest.raises(ValidationError) as error:
        JournalEvent.objects.create(
            growing_trial=trial,
            event_type=JournalEventEventType.WATERED,
            event_date=date(2026, 8, 2),
            note=note,
        )

    assert error.value.message_dict == {'note': [INVALID_JOURNAL_NOTE_MESSAGE]}


@pytest.mark.django_db
def test_journal_event_accepts_note_at_limit(trial):
    event = JournalEvent.objects.create(
        growing_trial=trial,
        event_type=JournalEventEventType.WATERED,
        event_date=date(2026, 8, 2),
        note='x' * 5000,
    )

    assert len(event.note) == 5000


@pytest.mark.django_db
def test_direct_save_trims_note_and_validates_normalized_length(trial):
    event = JournalEvent.objects.create(
        growing_trial=trial,
        event_type=JournalEventEventType.WATERED,
        event_date=date(2026, 8, 2),
        note='  First line\nSecond line  ',
    )
    padded_limit = JournalEvent(
        growing_trial=trial,
        event_type=JournalEventEventType.GERMINATED,
        event_date=date(2026, 8, 3),
        note='  ' + 'x' * 5000 + '  ',
    )
    padded_limit.save()

    event.refresh_from_db()
    padded_limit.refresh_from_db()
    assert event.note == 'First line\nSecond line'
    assert padded_limit.note == 'x' * 5000


@pytest.mark.django_db
def test_database_rejects_unsupported_event_type(trial):
    with pytest.raises(IntegrityError), transaction.atomic():
        JournalEvent.objects.bulk_create(
            [
                JournalEvent(
                    growing_trial=trial,
                    event_type='unsupported',
                    event_date=date(2026, 8, 2),
                    note='Note',
                )
            ]
        )


@pytest.mark.django_db
def test_deleting_trial_cascades_to_journal_events(trial):
    JournalEvent.objects.create(
        growing_trial=trial,
        event_type=JournalEventEventType.WATERED,
        event_date=date(2026, 8, 2),
        note='Note',
    )

    trial.delete()

    assert JournalEvent.objects.count() == 0


def test_journal_event_timeline_index_metadata_is_exact():
    assert [(index.name, index.fields) for index in JournalEvent._meta.indexes] == [
        (
            'journal_event_timeline_idx',
            ['growing_trial', '-event_date', '-created_at', '-id'],
        )
    ]

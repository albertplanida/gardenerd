from datetime import date

import pytest
from django.db import IntegrityError, connection, transaction
from django.db.migrations.executor import MigrationExecutor


@pytest.mark.django_db(transaction=True)
def test_initial_journal_migration_creates_constrained_event_table():
    migrate_from = [('growing_trials', '0004_growingtrial_terminal_fields')]
    migrate_to = [('journal', '0001_initial')]
    executor = MigrationExecutor(connection)

    try:
        executor.migrate(migrate_from)
        old_apps = executor.loader.project_state(migrate_from).apps
        plant = old_apps.get_model('plants', 'Plant').objects.create(name='Radish')
        container = old_apps.get_model('containers', 'Container').objects.create(
            name='Pot 1'
        )
        trial = old_apps.get_model('growing_trials', 'GrowingTrial').objects.create(
            plant_id=plant.pk,
            container_id=container.pk,
            status='active',
            start_date=date(2026, 8, 1),
            start_method='seed',
        )

        executor = MigrationExecutor(connection)
        executor.migrate(migrate_to)
        new_apps = executor.loader.project_state(migrate_to).apps
        JournalEvent = new_apps.get_model('journal', 'JournalEvent')
        assert [(index.name, index.fields) for index in JournalEvent._meta.indexes] == [
            (
                'journal_event_timeline_idx',
                ['growing_trial', '-event_date', '-created_at', '-id'],
            )
        ]
        event = JournalEvent.objects.create(
            growing_trial_id=trial.pk,
            event_type='watered',
            event_date=date(2026, 8, 2),
            note='Watered well',
        )

        assert event.pk is not None
        with pytest.raises(IntegrityError), transaction.atomic():
            JournalEvent.objects.create(
                growing_trial_id=trial.pk,
                event_type='unsupported',
                event_date=date(2026, 8, 2),
                note='Invalid',
            )
    finally:
        executor = MigrationExecutor(connection)
        executor.migrate(executor.loader.graph.leaf_nodes())

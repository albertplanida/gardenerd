from datetime import UTC, datetime

import pytest
from django.db import IntegrityError, connection, transaction
from django.db.migrations.executor import MigrationExecutor


@pytest.mark.django_db(transaction=True)
def test_migration_0002_to_0003_preserves_planned_trials():
    migrate_from = [('growing_trials', '0002_growingtrial_status_constraint')]
    migrate_to = [('growing_trials', '0003_growingtrial_start_fields')]
    executor = MigrationExecutor(connection)

    try:
        executor.migrate(migrate_from)
        old_apps = executor.loader.project_state(migrate_from).apps
        plant = old_apps.get_model('plants', 'Plant').objects.create(name='Radish')
        container = old_apps.get_model('containers', 'Container').objects.create(
            name='Pot 1'
        )
        old_trial = old_apps.get_model('growing_trials', 'GrowingTrial').objects.create(
            plant_id=plant.pk,
            container_id=container.pk,
            status='planned',
        )

        executor = MigrationExecutor(connection)
        executor.migrate(migrate_to)
        new_apps = executor.loader.project_state(migrate_to).apps
        migrated = new_apps.get_model('growing_trials', 'GrowingTrial').objects.get(
            pk=old_trial.pk
        )

        assert migrated.status == 'planned'
        assert migrated.start_date is None
        assert migrated.start_method is None
    finally:
        executor = MigrationExecutor(connection)
        executor.migrate(executor.loader.graph.leaf_nodes())


@pytest.mark.django_db(transaction=True)
def test_migration_0003_to_0004_backfills_only_terminal_trials():
    migrate_from = [('growing_trials', '0003_growingtrial_start_fields')]
    migrate_to = [('growing_trials', '0004_growingtrial_terminal_fields')]
    executor = MigrationExecutor(connection)

    try:
        executor.migrate(migrate_from)
        old_apps = executor.loader.project_state(migrate_from).apps
        GrowingTrial = old_apps.get_model('growing_trials', 'GrowingTrial')
        plant = old_apps.get_model('plants', 'Plant').objects.create(name='Radish')
        containers = [
            old_apps.get_model('containers', 'Container').objects.create(
                name=f'Pot {index}'
            )
            for index in range(1, 5)
        ]
        statuses = ['planned', 'active', 'completed', 'abandoned']
        trials = {}
        for status, container in zip(statuses, containers, strict=True):
            start_fields = (
                {'start_date': '2026-08-10', 'start_method': 'seed'}
                if status in ['active', 'completed']
                else {}
            )
            trials[status] = GrowingTrial.objects.create(
                plant_id=plant.pk,
                container_id=container.pk,
                status=status,
                **start_fields,
            )

        legacy_updated_at = datetime(2026, 8, 12, 23, 30, tzinfo=UTC)
        GrowingTrial.objects.filter(
            pk__in=[trials['completed'].pk, trials['abandoned'].pk]
        ).update(updated_at=legacy_updated_at)

        executor = MigrationExecutor(connection)
        executor.migrate(migrate_to)
        new_apps = executor.loader.project_state(migrate_to).apps
        MigratedTrial = new_apps.get_model('growing_trials', 'GrowingTrial')

        planned = MigratedTrial.objects.get(pk=trials['planned'].pk)
        active = MigratedTrial.objects.get(pk=trials['active'].pk)
        completed = MigratedTrial.objects.get(pk=trials['completed'].pk)
        abandoned = MigratedTrial.objects.get(pk=trials['abandoned'].pk)

        assert planned.end_date is None
        assert planned.result_summary == ''
        assert active.end_date is None
        assert active.result_summary == ''
        assert completed.end_date.isoformat() == '2026-08-12'
        assert completed.result_summary == ''
        assert abandoned.end_date.isoformat() == '2026-08-12'
        assert abandoned.result_summary == ''

        with pytest.raises(IntegrityError), transaction.atomic():
            MigratedTrial.objects.filter(pk=planned.pk).update(
                result_summary='Not allowed'
            )
        with pytest.raises(IntegrityError), transaction.atomic():
            MigratedTrial.objects.filter(pk=completed.pk).update(end_date=None)
    finally:
        executor = MigrationExecutor(connection)
        executor.migrate(executor.loader.graph.leaf_nodes())

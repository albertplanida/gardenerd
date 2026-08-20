import pytest
from django.db import connection
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

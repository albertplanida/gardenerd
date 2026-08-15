from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('growing_trials', '0002_growingtrial_status_constraint'),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name='growingtrial',
            name='growing_trial_valid_status',
        ),
        migrations.AlterField(
            model_name='growingtrial',
            name='status',
            field=models.CharField(
                choices=[
                    ('planned', 'Planned'),
                    ('active', 'Active'),
                    ('completed', 'Completed'),
                    ('abandoned', 'Abandoned'),
                ],
                default='planned',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='growingtrial',
            name='start_date',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='growingtrial',
            name='start_method',
            field=models.CharField(
                blank=True,
                choices=[
                    ('seed', 'Seed'),
                    ('seedling_transplant', 'Seedling/transplant'),
                ],
                max_length=20,
                null=True,
            ),
        ),
        migrations.AddConstraint(
            model_name='growingtrial',
            constraint=models.CheckConstraint(
                condition=models.Q(
                    ('status__in', ['planned', 'active', 'completed', 'abandoned'])
                ),
                name='growing_trial_valid_status',
            ),
        ),
        migrations.AddConstraint(
            model_name='growingtrial',
            constraint=models.CheckConstraint(
                condition=(
                    models.Q(('start_date__isnull', True), ('start_method__isnull', True))
                    | models.Q(
                        ('start_date__isnull', False),
                        ('start_method__isnull', False),
                    )
                ),
                name='growing_trial_start_fields_together',
            ),
        ),
        migrations.AddConstraint(
            model_name='growingtrial',
            constraint=models.CheckConstraint(
                condition=(
                    ~models.Q(('status', 'planned'))
                    | models.Q(
                        ('start_date__isnull', True), ('start_method__isnull', True)
                    )
                ),
                name='growing_trial_planned_without_start',
            ),
        ),
        migrations.AddConstraint(
            model_name='growingtrial',
            constraint=models.CheckConstraint(
                condition=(
                    ~models.Q(('status', 'active'))
                    | models.Q(
                        ('start_date__isnull', False),
                        ('start_method__isnull', False),
                    )
                ),
                name='growing_trial_active_has_start',
            ),
        ),
        migrations.AddConstraint(
            model_name='growingtrial',
            constraint=models.CheckConstraint(
                condition=(
                    ~models.Q(('status', 'completed'))
                    | models.Q(
                        ('start_date__isnull', False),
                        ('start_method__isnull', False),
                    )
                ),
                name='growing_trial_completed_has_start',
            ),
        ),
        migrations.AddConstraint(
            model_name='growingtrial',
            constraint=models.CheckConstraint(
                condition=(
                    models.Q(('start_method__isnull', True))
                    | models.Q(
                        ('start_method__in', ['seed', 'seedling_transplant'])
                    )
                ),
                name='growing_trial_valid_start_method',
            ),
        ),
        migrations.AddConstraint(
            model_name='growingtrial',
            constraint=models.UniqueConstraint(
                condition=models.Q(('status', 'active')),
                fields=('container',),
                name='one_active_growing_trial_per_container',
            ),
        ),
    ]

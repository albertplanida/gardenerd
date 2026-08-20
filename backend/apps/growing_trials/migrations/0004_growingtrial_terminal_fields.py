from django.db import migrations, models


def backfill_terminal_end_dates(apps, schema_editor):
    GrowingTrial = apps.get_model('growing_trials', 'GrowingTrial')
    for trial in GrowingTrial.objects.filter(status__in=['completed', 'abandoned']):
        trial.end_date = trial.updated_at.date()
        trial.save(update_fields=['end_date'])


class Migration(migrations.Migration):
    dependencies = [
        ('growing_trials', '0003_growingtrial_start_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='growingtrial',
            name='end_date',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='growingtrial',
            name='result_summary',
            field=models.TextField(blank=True, default='', max_length=5000),
        ),
        migrations.RunPython(
            backfill_terminal_end_dates,
            reverse_code=migrations.RunPython.noop,
        ),
        migrations.AddConstraint(
            model_name='growingtrial',
            constraint=models.CheckConstraint(
                condition=(
                    models.Q(
                        ('end_date__isnull', False),
                        ('status__in', ['completed', 'abandoned']),
                    )
                    | models.Q(
                        ('end_date__isnull', True),
                        ('result_summary', ''),
                        ('status__in', ['planned', 'active']),
                    )
                ),
                name='growing_trial_terminal_fields_match_status',
            ),
        ),
    ]

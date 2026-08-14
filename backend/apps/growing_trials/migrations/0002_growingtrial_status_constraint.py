from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('growing_trials', '0001_initial'),
    ]

    operations = [
        migrations.AddConstraint(
            model_name='growingtrial',
            constraint=models.CheckConstraint(
                condition=models.Q(status__in=['planned']),
                name='growing_trial_valid_status',
            ),
        ),
    ]

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ('growing_trials', '0004_growingtrial_terminal_fields'),
    ]

    operations = [
        migrations.CreateModel(
            name='JournalEvent',
            fields=[
                (
                    'id',
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name='ID',
                    ),
                ),
                (
                    'event_type',
                    models.CharField(
                        choices=[
                            ('planted', 'Planted'),
                            ('watered', 'Watered'),
                            ('germinated', 'Germinated'),
                            ('fertilized', 'Fertilized'),
                            ('pruned', 'Pruned'),
                            ('harvested', 'Harvested'),
                            ('problem_noticed', 'Problem noticed'),
                            ('photo_taken', 'Photo taken'),
                            ('general_observation', 'General observation'),
                        ],
                        max_length=20,
                    ),
                ),
                ('event_date', models.DateField()),
                ('note', models.TextField(max_length=5000)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                (
                    'growing_trial',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='journal_events',
                        to='growing_trials.growingtrial',
                    ),
                ),
            ],
            options={
                'constraints': [
                    models.CheckConstraint(
                        condition=models.Q(
                            event_type__in=[
                                'planted',
                                'watered',
                                'germinated',
                                'fertilized',
                                'pruned',
                                'harvested',
                                'problem_noticed',
                                'photo_taken',
                                'general_observation',
                            ]
                        ),
                        name='journal_event_valid_event_type',
                    )
                ]
            },
        ),
    ]

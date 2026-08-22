import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('journal', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='JournalPhoto',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('full_object_key', models.CharField(max_length=500)),
                ('thumbnail_object_key', models.CharField(max_length=500)),
                ('original_filename', models.CharField(max_length=255)),
                ('content_type', models.CharField(max_length=20)),
                ('file_size', models.PositiveBigIntegerField()),
                ('original_upload_size', models.PositiveBigIntegerField()),
                ('width', models.PositiveIntegerField()),
                ('height', models.PositiveIntegerField()),
                ('position', models.PositiveIntegerField()),
                ('client_upload_id', models.UUIDField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('journal_event', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='photos', to='journal.journalevent')),
            ],
            options={
                'ordering': ['position', 'id'],
                'constraints': [
                    models.UniqueConstraint(fields=('journal_event', 'client_upload_id'), name='journal_photo_event_client_upload_unique'),
                    models.UniqueConstraint(fields=('journal_event', 'position'), name='journal_photo_event_position_unique'),
                    models.CheckConstraint(condition=models.Q(('position__gte', 0)), name='journal_photo_position_nonnegative'),
                ],
            },
        ),
    ]

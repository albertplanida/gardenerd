from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('plants', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='plant',
            name='care_notes',
            field=models.TextField(blank=True, max_length=5000),
        ),
    ]

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('sheep_management', '0021_user_latitude_user_longitude_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='business_license',
            field=models.ImageField(blank=True, null=True, upload_to='qualifications/', verbose_name='营业执照'),
        ),
        migrations.AddField(
            model_name='user',
            name='env_protection_doc',
            field=models.ImageField(blank=True, null=True, upload_to='qualifications/', verbose_name='环保手续'),
        ),
        migrations.AddField(
            model_name='user',
            name='animal_prevention_cert',
            field=models.ImageField(blank=True, null=True, upload_to='qualifications/', verbose_name='动物防疫条件合格证'),
        ),
    ]

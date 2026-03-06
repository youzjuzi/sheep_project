from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('sheep_management', '0022_user_qualification_docs'),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='receiver_name',
            field=models.CharField(blank=True, max_length=50, null=True, verbose_name='收货人姓名'),
        ),
        migrations.AddField(
            model_name='order',
            name='receiver_phone',
            field=models.CharField(blank=True, max_length=20, null=True, verbose_name='收货人手机'),
        ),
        migrations.AddField(
            model_name='order',
            name='shipping_address',
            field=models.TextField(blank=True, null=True, verbose_name='收货地址'),
        ),
    ]

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('sheep_management', '0018_coupon_owner_non_nullable'),
    ]

    operations = [
        migrations.CreateModel(
            name='KnowledgeDocument',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=200, verbose_name='标题')),
                ('content', models.TextField(verbose_name='内容')),
                ('category', models.CharField(
                    choices=[
                        ('breeding', '养殖技术'),
                        ('nutrition', '营养价值'),
                        ('health', '健康护理'),
                        ('vaccine', '疫苗防疫'),
                        ('cooking', '烹饪方法'),
                        ('product', '产品特色'),
                        ('trading', '购买指南'),
                        ('environment', '环境管理'),
                        ('general', '通用知识'),
                    ],
                    default='general',
                    max_length=50,
                    verbose_name='分类',
                )),
                ('keywords', models.CharField(
                    blank=True, max_length=500,
                    verbose_name='关键词（逗号分隔）',
                    help_text='用于辅助检索的关键词，逗号隔开',
                )),
                ('is_active', models.BooleanField(default=True, verbose_name='启用')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='创建时间')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='更新时间')),
            ],
            options={
                'verbose_name': '知识文档',
                'verbose_name_plural': '知识文档',
                'db_table': 'knowledge_documents',
                'ordering': ['category', 'id'],
            },
        ),
    ]

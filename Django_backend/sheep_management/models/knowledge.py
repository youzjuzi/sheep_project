"""知识库文档模型 - 用于RAG检索增强生成"""
from django.db import models


class KnowledgeDocument(models.Model):
    """知识库文档 - 存储滩羊领域知识，供RAG检索使用"""

    CATEGORY_CHOICES = [
        ('breeding', '养殖技术'),
        ('nutrition', '营养价值'),
        ('health', '健康护理'),
        ('vaccine', '疫苗防疫'),
        ('cooking', '烹饪方法'),
        ('product', '产品特色'),
        ('trading', '购买指南'),
        ('environment', '环境管理'),
        ('general', '通用知识'),
    ]

    title = models.CharField(max_length=200, verbose_name='标题')
    content = models.TextField(verbose_name='内容')
    category = models.CharField(
        max_length=50, choices=CATEGORY_CHOICES,
        default='general', verbose_name='分类'
    )
    keywords = models.CharField(
        max_length=500, blank=True,
        verbose_name='关键词（逗号分隔）',
        help_text='用于辅助检索的关键词，逗号隔开'
    )
    is_active = models.BooleanField(default=True, verbose_name='启用')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'knowledge_documents'
        verbose_name = '知识文档'
        verbose_name_plural = '知识文档'
        ordering = ['category', 'id']

    def __str__(self):
        return f'[{self.get_category_display()}] {self.title}'

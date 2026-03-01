"""
审计日志模型 - 记录管理员的操作
"""
from django.db import models
from .user import User


class AuditLog(models.Model):
    """审计日志"""
    ACTION_CHOICES = [
        ('role_change', '角色变更'),
        ('breeder_approved', '养殖户批准'),
        ('breeder_rejected', '养殖户拒绝'),
        ('user_created', '用户创建'),
        ('user_deleted', '用户删除'),
        ('order_handled', '订单处理'),
        ('data_modified', '数据修改'),
        ('other', '其他'),
    ]
    
    admin = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='audit_logs',
                              verbose_name='操作管理员')
    action = models.CharField(max_length=50, choices=ACTION_CHOICES, verbose_name='操作类型')
    target_user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                                    related_name='audit_target_logs', verbose_name='目标用户')
    details = models.TextField(blank=True, verbose_name='操作详情')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='操作时间')
    
    class Meta:
        db_table = 'audit_logs'
        verbose_name = '审计日志'
        verbose_name_plural = '审计日志'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['admin', '-created_at']),
            models.Index(fields=['action', '-created_at']),
        ]
    
    def __str__(self):
        return f"{self.get_action_display()} - {self.admin.username if self.admin else 'Unknown'}"

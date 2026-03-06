from django.db import models
from django.contrib.auth.models import AbstractUser

class User(AbstractUser):
    """用户表"""
    GENDER_CHOICES = [
        (0, '未知'),
        (1, '男'),
        (2, '女'),
    ]
    
    ROLE_CHOICES = [
        (0, '普通用户'),
        (1, '养殖户'),
        (2, '管理员'),
    ]

    role = models.IntegerField(choices=ROLE_CHOICES, default=0, verbose_name='用户角色')
    is_verified = models.BooleanField(default=False, verbose_name='养殖户是否审核通过')

    openid = models.CharField(max_length=128, unique=True, null=True, blank=True, verbose_name='微信openid')
    unionid = models.CharField(max_length=128, null=True, blank=True, verbose_name='微信unionid')
    nickname = models.CharField(max_length=100, null=True, blank=True, verbose_name='昵称')
    avatar_url = models.CharField(max_length=500, null=True, blank=True, verbose_name='头像URL')
    mobile = models.CharField(max_length=20, null=True, blank=True, verbose_name='手机号')
    balance = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, verbose_name='账户余额（元）')
    gender = models.IntegerField(choices=GENDER_CHOICES, null=True, blank=True, verbose_name='性别')
    description = models.CharField(max_length=200, null=True, blank=True, verbose_name='个人简介')
    birthday = models.DateField(null=True, blank=True, verbose_name='生日')
    country = models.CharField(max_length=50, null=True, blank=True, verbose_name='国家')
    province = models.CharField(max_length=50, null=True, blank=True, verbose_name='省份')
    city = models.CharField(max_length=50, null=True, blank=True, verbose_name='城市')
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True, verbose_name='纬度')
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True, verbose_name='经度')

    # 养殖户申请资质文件
    business_license      = models.ImageField(upload_to='qualifications/', null=True, blank=True, verbose_name='营业执照')
    env_protection_doc    = models.ImageField(upload_to='qualifications/', null=True, blank=True, verbose_name='环保手续')
    animal_prevention_cert = models.ImageField(upload_to='qualifications/', null=True, blank=True, verbose_name='动物防疫条件合格证')

    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'users'
        verbose_name = '用户'
        verbose_name_plural = '用户'

    def __str__(self):
        return f"{self.nickname or self.username}"
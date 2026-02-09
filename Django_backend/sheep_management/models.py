from django.db import models
import qrcode
from io import BytesIO
from django.core.files import File
from pathlib import Path
import os


class Sheep(models.Model):
    """羊只基本信息表"""
    GENDER_CHOICES = [
        (0, '母'),
        (1, '公'),
    ]
    ear_tag = models.CharField(max_length=50, null=True, blank=True, verbose_name='耳标编号')
    gender = models.IntegerField(choices=GENDER_CHOICES, verbose_name='性别')
    weight = models.FloatField(verbose_name='体重（kg）')
    height = models.FloatField(verbose_name='身高（cm）')
    length = models.FloatField(verbose_name='体长（cm）')
    breeder = models.ForeignKey('Breeder', on_delete=models.SET_NULL, null=True, blank=True, related_name='sheep_list',
                                db_column='breeder_id', verbose_name='养殖户')
    qr_code = models.ImageField(upload_to='qrcodes/', null=True, blank=True, verbose_name='二维码')

    class Meta:
        db_table = 'sheep'
        verbose_name = '羊只信息'
        verbose_name_plural = '羊只信息'

    def __str__(self):
        return f"羊只#{self.id} - {self.get_gender_display()} - {self.weight}kg"
    
    def save(self, *args, **kwargs):
        """
        重写save方法，自动生成二维码
        每次保存时，如果有耳标编号，就生成对应的二维码
        """
        # 先保存一次，确保有ID
        if not self.id:
            super().save(*args, **kwargs)
        
        # 如果有耳标编号，生成二维码
        if self.ear_tag:
            # 创建二维码实例
            qr = qrcode.QRCode(
                version=1,  # 控制二维码大小，1是最小的
                error_correction=qrcode.constants.ERROR_CORRECT_L,  # 纠错级别
                box_size=10,  # 每个格子的像素大小
                border=4,  # 边框格子数
            )
            
            # 添加数据（耳标编号）
            qr.add_data(self.ear_tag)
            qr.make(fit=True)
            
            # 创建图片
            img = qr.make_image(fill_color="black", back_color="white")
            
            # 保存到BytesIO
            buffer = BytesIO()
            img.save(buffer, format='PNG')
            buffer.seek(0)
            
            # 生成文件名
            filename = f'sheep_{self.id}_{self.ear_tag}.png'
            
            # 删除旧的二维码文件（如果存在）
            if self.qr_code:
                try:
                    if os.path.isfile(self.qr_code.path):
                        os.remove(self.qr_code.path)
                except Exception as e:
                    print(f"删除旧二维码失败: {e}")
            
            # 保存新的二维码
            self.qr_code.save(filename, File(buffer), save=False)
        
        # 最终保存
        super().save(*args, **kwargs)


class Breeder(models.Model):
    """养殖户信息表"""
    name = models.CharField(max_length=100, verbose_name='姓名')
    gender = models.CharField(max_length=10, verbose_name='性别（男/女）')
    phone = models.CharField(max_length=20, verbose_name='联系电话')
    sheep_count = models.IntegerField(verbose_name='羊只总数')
    sheep_id = models.CharField(max_length=50, unique=True, verbose_name='羊只编号')
    female_count = models.IntegerField(verbose_name='母羊数量')
    male_count = models.IntegerField(verbose_name='公羊数量')

    # 注意：这里已经删除了 latitude, longitude 和 address
    # 这样代码就和数据库里的表结构完全一致了

    class Meta:
        db_table = 'breeders'
        verbose_name = '养殖户信息'
        verbose_name_plural = '养殖户信息'

    def __str__(self):
        return f"{self.name} - {self.phone}"


class GrowthRecord(models.Model):
    """生长记录表"""
    sheep = models.ForeignKey(Sheep, on_delete=models.CASCADE, related_name='growth_records', verbose_name='羊只')
    record_date = models.DateField(verbose_name='记录日期')
    weight = models.FloatField(verbose_name='体重（kg）')
    height = models.FloatField(verbose_name='身高（cm）')
    length = models.FloatField(verbose_name='体长（cm）')

    class Meta:
        db_table = 'growth_records'
        verbose_name = '生长记录'
        verbose_name_plural = '生长记录'

    def __str__(self):
        return f"{self.sheep} - {self.record_date}"


class FeedingRecord(models.Model):
    """喂养记录表"""
    sheep = models.ForeignKey(Sheep, on_delete=models.CASCADE, related_name='feeding_records', verbose_name='羊只')
    feed_type = models.CharField(max_length=100, verbose_name='饲料类型')
    start_date = models.DateField(verbose_name='开始日期')
    end_date = models.DateField(null=True, blank=True, verbose_name='结束日期')
    amount = models.FloatField(verbose_name='数量')
    unit = models.CharField(max_length=20, verbose_name='单位')

    class Meta:
        db_table = 'feeding_records'
        verbose_name = '喂养记录'
        verbose_name_plural = '喂养记录'

    def __str__(self):
        return f"{self.sheep} - {self.feed_type} - {self.start_date}"


class VaccinationHistory(models.Model):
    """疫苗接种历史表"""
    VACCINE_CHOICES = [
        (1, '口蹄疫苗'),
        (2, '传染性胸膜肺炎灭活疫苗'),
        (3, '四联苗'),
    ]

    vaccination_id = models.IntegerField(choices=VACCINE_CHOICES, db_column='VaccinationID', verbose_name='疫苗类型ID')
    sheep = models.ForeignKey(Sheep, on_delete=models.CASCADE, related_name='vaccination_records', db_column='sheep_id',
                              verbose_name='羊只')
    vaccination_date = models.DateField(db_column='VaccinationDate', verbose_name='接种日期')
    expiry_date = models.DateField(db_column='ExpiryDate', verbose_name='过期日期')
    dosage = models.FloatField(db_column='Dosage', verbose_name='剂量（ml）')
    administered_by = models.CharField(max_length=100, db_column='AdministeredBy', verbose_name='接种人')
    notes = models.TextField(null=True, blank=True, db_column='Notes', verbose_name='备注')
    vaccine_type = models.CharField(max_length=100, null=True, blank=True, db_column='VaccineType',
                                    verbose_name='疫苗类型名称')

    class Meta:
        db_table = 'vaccinationhistory'
        verbose_name = '疫苗接种记录'
        verbose_name_plural = '疫苗接种记录'

    def __str__(self):
        return f"{self.sheep} - {self.get_vaccination_id_display()} - {self.vaccination_date}"


class User(models.Model):
    """用户表"""
    GENDER_CHOICES = [
        (0, '未知'),
        (1, '男'),
        (2, '女'),
    ]

    username = models.CharField(max_length=100, null=True, blank=True, verbose_name='用户名')
    password = models.CharField(max_length=255, null=True, blank=True, verbose_name='密码')
    openid = models.CharField(max_length=128, unique=True, verbose_name='微信openid')
    unionid = models.CharField(max_length=128, null=True, blank=True, verbose_name='微信unionid')
    nickname = models.CharField(max_length=100, null=True, blank=True, verbose_name='昵称')
    avatar_url = models.CharField(max_length=500, null=True, blank=True, verbose_name='头像URL')
    mobile = models.CharField(max_length=20, null=True, blank=True, verbose_name='手机号')
    gender = models.IntegerField(choices=GENDER_CHOICES, null=True, blank=True, verbose_name='性别')
    country = models.CharField(max_length=50, null=True, blank=True, verbose_name='国家')
    province = models.CharField(max_length=50, null=True, blank=True, verbose_name='省份')
    city = models.CharField(max_length=50, null=True, blank=True, verbose_name='城市')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    last_login_at = models.DateTimeField(null=True, blank=True, verbose_name='最后登录时间')

    class Meta:
        db_table = 'users'
        verbose_name = '用户'
        verbose_name_plural = '用户'

    def __str__(self):
        return f"{self.nickname or self.openid}"


class CartItem(models.Model):
    """购物车表"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='cart_items', verbose_name='用户')
    sheep = models.ForeignKey(Sheep, on_delete=models.CASCADE, related_name='cart_items', verbose_name='羊只')
    quantity = models.IntegerField(default=1, verbose_name='数量')
    price = models.FloatField(verbose_name='单价')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='添加时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'cart_items'
        verbose_name = '购物车商品'
        verbose_name_plural = '购物车商品'
        unique_together = ('user', 'sheep')  # 同一用户同一羊只只能有一条记录

    def __str__(self):
        return f"{self.user} - {self.sheep} - {self.quantity}件"


class PromotionActivity(models.Model):
    """优惠活动表"""
    ACTIVITY_TYPE_CHOICES = [
        ('flash_sale', '限时抢购'),
        ('package', '套餐活动'),
        ('discount', '折扣活动'),
    ]
    
    STATUS_CHOICES = [
        ('draft', '草稿'),
        ('active', '进行中'),
        ('ended', '已结束'),
        ('cancelled', '已取消'),
    ]
    
    title = models.CharField(max_length=200, verbose_name='活动标题')
    description = models.TextField(null=True, blank=True, verbose_name='活动描述')
    activity_type = models.CharField(max_length=20, choices=ACTIVITY_TYPE_CHOICES, verbose_name='活动类型')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft', verbose_name='状态')
    image_url = models.CharField(max_length=500, null=True, blank=True, verbose_name='活动图片')
    
    # 活动时间
    start_time = models.DateTimeField(verbose_name='开始时间')
    end_time = models.DateTimeField(verbose_name='结束时间')
    
    # 活动规则
    discount_rate = models.FloatField(null=True, blank=True, verbose_name='折扣率（0-1）')
    discount_amount = models.FloatField(null=True, blank=True, verbose_name='折扣金额')
    min_purchase_amount = models.FloatField(null=True, blank=True, default=0, verbose_name='最低消费金额')
    max_discount_amount = models.FloatField(null=True, blank=True, verbose_name='最大折扣金额')
    
    # 限制条件
    total_limit = models.IntegerField(null=True, blank=True, verbose_name='总限购数量')
    user_limit = models.IntegerField(null=True, blank=True, default=1, verbose_name='每用户限购数量')
    sold_count = models.IntegerField(default=0, verbose_name='已售数量')
    
    # 关联商品（可选，如果为空则适用于所有商品）
    applicable_sheep_ids = models.TextField(null=True, blank=True, verbose_name='适用羊只ID列表（JSON格式）')
    
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    
    class Meta:
        db_table = 'promotion_activities'
        verbose_name = '优惠活动'
        verbose_name_plural = '优惠活动'
        ordering = ['-start_time']
    
    def __str__(self):
        return f"{self.title} - {self.get_status_display()}"


class Coupon(models.Model):
    """优惠券表"""
    COUPON_TYPE_CHOICES = [
        ('discount', '满减券'),
        ('percentage', '折扣券'),
        ('cash', '现金券'),
    ]
    
    STATUS_CHOICES = [
        ('active', '可用'),
        ('inactive', '不可用'),
        ('expired', '已过期'),
    ]
    
    name = models.CharField(max_length=200, verbose_name='优惠券名称')
    code = models.CharField(max_length=50, unique=True, verbose_name='优惠券代码')
    coupon_type = models.CharField(max_length=20, choices=COUPON_TYPE_CHOICES, verbose_name='优惠券类型')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active', verbose_name='状态')
    
    # 优惠规则
    discount_amount = models.FloatField(null=True, blank=True, verbose_name='优惠金额（满减券/现金券）')
    discount_rate = models.FloatField(null=True, blank=True, verbose_name='折扣率（折扣券，0-1）')
    min_purchase_amount = models.FloatField(default=0, verbose_name='最低消费金额')
    max_discount_amount = models.FloatField(null=True, blank=True, verbose_name='最大折扣金额')
    
    # 使用限制
    total_count = models.IntegerField(null=True, blank=True, verbose_name='总发放数量')
    used_count = models.IntegerField(default=0, verbose_name='已使用数量')
    user_limit = models.IntegerField(default=1, verbose_name='每用户限领数量')
    
    # 有效期
    valid_from = models.DateTimeField(verbose_name='生效时间')
    valid_until = models.DateTimeField(verbose_name='失效时间')
    
    description = models.TextField(null=True, blank=True, verbose_name='使用说明')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    
    class Meta:
        db_table = 'coupons'
        verbose_name = '优惠券'
        verbose_name_plural = '优惠券'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.name} ({self.code})"


class UserCoupon(models.Model):
    """用户优惠券关联表"""
    STATUS_CHOICES = [
        ('unused', '未使用'),
        ('used', '已使用'),
        ('expired', '已过期'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='user_coupons', verbose_name='用户')
    coupon = models.ForeignKey(Coupon, on_delete=models.CASCADE, related_name='user_coupons', verbose_name='优惠券')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='unused', verbose_name='使用状态')
    obtained_at = models.DateTimeField(auto_now_add=True, verbose_name='领取时间')
    used_at = models.DateTimeField(null=True, blank=True, verbose_name='使用时间')
    order_id = models.IntegerField(null=True, blank=True, verbose_name='使用的订单ID')
    
    class Meta:
        db_table = 'user_coupons'
        verbose_name = '用户优惠券'
        verbose_name_plural = '用户优惠券'
        unique_together = ('user', 'coupon')  # 同一用户同一优惠券只能有一条记录
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['coupon', 'status']),
        ]
    
    def __str__(self):
        return f"{self.user} - {self.coupon} - {self.get_status_display()}"
from django.db import models
from .user import User
from .sheep import Sheep

class CartItem(models.Model):
    """购物车表"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='cart_items', verbose_name='用户')
    sheep = models.ForeignKey(Sheep, on_delete=models.CASCADE, related_name='cart_items', verbose_name='羊只')
    quantity = models.IntegerField(default=1, verbose_name='数量')
    price = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='单价')
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
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, verbose_name='折扣金额')
    min_purchase_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, default=0, verbose_name='最低消费金额')
    max_discount_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, verbose_name='最大折扣金额')

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
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, verbose_name='优惠金额（满减券/现金券）')
    discount_rate = models.FloatField(null=True, blank=True, verbose_name='折扣率（折扣券，0-1）')
    min_purchase_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='最低消费金额')
    max_discount_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, verbose_name='最大折扣金额')

    # 使用限制
    total_count = models.IntegerField(null=True, blank=True, verbose_name='总发放数量')
    used_count = models.IntegerField(default=0, verbose_name='已使用数量')
    user_limit = models.IntegerField(default=1, verbose_name='每用户限领数量')

    # 有效期
    valid_from = models.DateTimeField(verbose_name='生效时间')
    valid_until = models.DateTimeField(verbose_name='失效时间')

    description = models.TextField(null=True, blank=True, verbose_name='使用说明')
    
    # 所属养殖户
    owner = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='coupons',
        limit_choices_to={'role': 1},
        verbose_name='所属养殖户'
    )
    
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



class BreederFollow(models.Model):
    """用户关注养殖户关系表"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='followed_breeders', verbose_name='用户')
    breeder = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='breeder_followers',
        limit_choices_to={'role': 1},
        verbose_name='养殖户'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='关注时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'breeder_follows'
        verbose_name = '养殖户关注关系'
        verbose_name_plural = '养殖户关注关系'
        unique_together = ('user', 'breeder')
        indexes = [
            models.Index(fields=['user']),
            models.Index(fields=['breeder']),
        ]

    def __str__(self):
        return f"{self.user} -> {self.breeder}"
class Order(models.Model):
    """订单主表"""
    STATUS_CHOICES = [
        ('pending', '待支付'),
        ('paid', '已支付/认养中'),
        ('shipping', '已发货'),
        ('completed', '已完成'),
        ('cancelled', '已取消'),
    ]

    user = models.ForeignKey('User', on_delete=models.CASCADE, related_name='orders', verbose_name='认养用户')
    order_no = models.CharField(max_length=50, unique=True, verbose_name='订单编号')
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='订单总金额')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', verbose_name='订单状态')

    # 收货信息
    receiver_name    = models.CharField(max_length=50,  null=True, blank=True, verbose_name='收货人姓名')
    receiver_phone   = models.CharField(max_length=20,  null=True, blank=True, verbose_name='收货人手机')
    shipping_address = models.TextField(null=True, blank=True, verbose_name='收货地址')

    # 物流信息
    logistics_company = models.CharField(max_length=100, null=True, blank=True, verbose_name='物流公司')
    logistics_tracking_number = models.CharField(max_length=100, null=True, blank=True, verbose_name='物流单号')
    shipping_date = models.DateTimeField(null=True, blank=True, verbose_name='发货日期')
    delivery_date = models.DateTimeField(null=True, blank=True, verbose_name='送达日期')

    # 以后如果你要接微信支付，这里还可以加上 transaction_id(微信流水号)
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    pay_time = models.DateTimeField(null=True, blank=True, verbose_name='支付时间')

    class Meta:
        db_table = 'orders'
        verbose_name = '订单'
        verbose_name_plural = '订单'
        ordering = ['-created_at']

    def __str__(self):
        return f"订单号:{self.order_no} - {self.get_status_display()}"


class OrderItem(models.Model):
    """订单明细表（记录这个订单买下了哪几只羊）"""
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items', verbose_name='所属订单')
    sheep = models.ForeignKey('Sheep', on_delete=models.CASCADE, related_name='order_items', verbose_name='认养的羊只')
    price = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='买入单价')

    class Meta:
        db_table = 'order_items'
        verbose_name = '订单明细'
        verbose_name_plural = '订单明细'

    def __str__(self):
        return f"{self.order.order_no} - {self.sheep}"


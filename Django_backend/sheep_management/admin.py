from django.contrib import admin
from .models import Sheep, GrowthRecord, FeedingRecord, VaccineType, VaccinationHistory, User, CartItem, Order, OrderItem
from django.utils.html import format_html


@admin.register(Sheep)
class SheepAdmin(admin.ModelAdmin):
    list_display = ['id', 'ear_tag', 'get_gender_display', 'weight', 'height', 'length', 'price', 'owner', 'qrcode_preview']
    list_filter = ['gender', 'owner']
    search_fields = ['id', 'ear_tag', 'owner__username', 'owner__nickname']
    list_per_page = 20
    readonly_fields = ['qrcode_image']

    def qrcode_preview(self, obj):
        """在列表页显示二维码缩略图"""
        if obj.qr_code:
            return format_html('<img src="{}" width="50" height="50" />', obj.qr_code.url)
        return "未生成"
    qrcode_preview.short_description = '二维码'

    def qrcode_image(self, obj):
        """在详情页显示完整二维码"""
        if obj.qr_code:
            return format_html('<img src="{}" width="200" height="200" />', obj.qr_code.url)
        return "未生成二维码"
    qrcode_image.short_description = '二维码图片'


@admin.register(GrowthRecord)
class GrowthRecordAdmin(admin.ModelAdmin):
    list_display = ['id', 'sheep', 'record_date', 'weight', 'height', 'length']
    list_filter = ['record_date', 'sheep']
    search_fields = ['sheep__id']
    date_hierarchy = 'record_date'
    list_per_page = 20


@admin.register(FeedingRecord)
class FeedingRecordAdmin(admin.ModelAdmin):
    list_display = ['id', 'sheep', 'feed_type', 'start_date', 'end_date', 'amount', 'unit']
    list_filter = ['feed_type', 'start_date']
    search_fields = ['sheep__id', 'feed_type']
    date_hierarchy = 'start_date'
    list_per_page = 20


@admin.register(VaccineType)
class VaccineTypeAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'manufacturer', 'validity_days', 'created_at']
    search_fields = ['name', 'manufacturer']
    list_per_page = 20


@admin.register(VaccinationHistory)
class VaccinationHistoryAdmin(admin.ModelAdmin):
    list_display = ['id', 'sheep', 'vaccine', 'vaccination_date', 'expiry_date', 'dosage', 'administered_by']
    list_filter = ['vaccine', 'vaccination_date', 'administered_by']
    search_fields = ['sheep__id', 'administered_by']
    date_hierarchy = 'vaccination_date'
    list_per_page = 20


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ['id', 'username', 'nickname', 'openid', 'mobile', 'role', 'is_verified', 'created_at']
    list_filter = ['gender', 'role', 'is_verified', 'created_at']
    search_fields = ['username', 'nickname', 'openid', 'mobile']
    readonly_fields = ['created_at', 'updated_at']
    list_per_page = 20
    fieldsets = (
        ('基本信息', {
            'fields': ('username', 'password', 'nickname', 'mobile', 'gender')
        }),
        ('角色权限', {
            'fields': ('role', 'is_verified', 'is_staff', 'is_superuser', 'is_active')
        }),
        ('微信信息', {
            'fields': ('openid', 'unionid', 'avatar_url')
        }),
        ('地址信息', {
            'fields': ('country', 'province', 'city')
        }),
        ('时间信息', {
            'fields': ('created_at', 'updated_at')
        }),
    )


@admin.register(CartItem)
class CartItemAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'sheep', 'quantity', 'price', 'created_at']
    list_filter = ['created_at', 'user']
    search_fields = ['user__username', 'user__nickname', 'sheep__id']
    date_hierarchy = 'created_at'
    list_per_page = 20
    readonly_fields = ['created_at', 'updated_at']


class OrderItemInline(admin.TabularInline):
    """订单明细内联（嵌入到订单详情页中）"""
    model = OrderItem
    extra = 0
    readonly_fields = ['sheep', 'price']


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ['id', 'order_no', 'user', 'total_amount', 'status', 'created_at', 'pay_time']
    list_filter = ['status', 'created_at']
    search_fields = ['order_no', 'user__username', 'user__nickname']
    date_hierarchy = 'created_at'
    list_per_page = 20
    readonly_fields = ['created_at']
    inlines = [OrderItemInline]


@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = ['id', 'order', 'sheep', 'price']
    list_filter = ['order__status']
    search_fields = ['order__order_no', 'sheep__id', 'sheep__ear_tag']
    list_per_page = 20


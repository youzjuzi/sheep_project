"""
商业模块业务逻辑 Service
购物车增删改查 + 结算下单 + 我的羊查询
所有方法为纯业务逻辑，不依赖任何 HTTP Request/Response 对象。
"""
import uuid
from decimal import Decimal
from django.utils import timezone

from ..models import CartItem, Sheep, Order, OrderItem, UserCoupon
from .user_service import UserService, UserError


class CommerceError(Exception):
    """商业模块业务异常"""
    def __init__(self, message, code=400, http_status=400):
        self.message = message
        self.code = code          # 业务错误码
        self.http_status = http_status  # HTTP 状态码
        super().__init__(self.message)


class CommerceService:
    """购物车 & 领养相关业务逻辑"""

    # ========================
    #  购物车操作
    # ========================

    @staticmethod
    def add_to_cart(token, sheep_id, quantity=1, price=None):
        """
        领养/加入购物车
        :param token: 用户 JWT token
        :param sheep_id: 羊只 ID
        :param quantity: 数量（默认 1）
        :param price: 单价（如不传，默认按 weight * 10 计算）
        :return: dict 购物车项信息
        """
        user = CommerceService._resolve_user(token)

        if not sheep_id:
            raise CommerceError('缺少羊只ID参数')

        try:
            sheep = Sheep.objects.get(pk=sheep_id)
        except Sheep.DoesNotExist:
            raise CommerceError('羊只不存在', code=404, http_status=404)

        # 检查是否已在购物车中
        existing = CartItem.objects.filter(user=user, sheep=sheep).first()
        if existing:
            # 已存在则更新数量
            existing.quantity += quantity
            existing.save(update_fields=['quantity', 'updated_at'])
            return CommerceService._build_cart_item(existing)

        # 计算价格：如果前端没有传价格，使用羊只自身的定价
        if price is None or price == 0:
            price = sheep.price if sheep.price else Decimal('0')
        else:
            price = Decimal(str(price))

        cart_item = CartItem.objects.create(
            user=user,
            sheep=sheep,
            quantity=quantity,
            price=price,
        )
        return CommerceService._build_cart_item(cart_item)

    @staticmethod
    def get_cart(token):
        """
        获取用户购物车列表
        :param token: 用户 JWT token
        :return: list[dict]
        """
        user = CommerceService._resolve_user(token)
        items = CartItem.objects.filter(user=user).select_related('sheep').order_by('-created_at')

        return [CommerceService._build_cart_item(item) for item in items]

    @staticmethod
    def remove_from_cart(token, cart_item_id):
        """
        从购物车移除
        :param token: 用户 JWT token
        :param cart_item_id: 购物车项 ID
        """
        user = CommerceService._resolve_user(token)

        try:
            item = CartItem.objects.get(pk=cart_item_id, user=user)
        except CartItem.DoesNotExist:
            raise CommerceError('购物车项不存在', code=404, http_status=404)

        item.delete()

    @staticmethod
    def update_cart_item(token, cart_item_id, quantity):
        """
        更新购物车商品数量
        :param token: 用户 JWT token
        :param cart_item_id: 购物车项 ID
        :param quantity: 新数量
        :return: dict 更新后的购物车项
        """
        user = CommerceService._resolve_user(token)

        if not quantity or quantity < 1:
            raise CommerceError('数量必须大于0')

        try:
            item = CartItem.objects.get(pk=cart_item_id, user=user)
        except CartItem.DoesNotExist:
            raise CommerceError('购物车项不存在', code=404, http_status=404)

        item.quantity = quantity
        item.save(update_fields=['quantity', 'updated_at'])
        return CommerceService._build_cart_item(item)

    # ========================
    #  羊只领养状态查询
    # ========================

    @staticmethod
    def get_sheep_adopt_status(token, sheep_id):
        """
        查询羊只的领养状态
        :param token: 用户 JWT token（可为空，未登录时也能查）
        :param sheep_id: 羊只 ID
        :return: dict { status, status_text }
          status: 'available' | 'in_my_cart' | 'adopted_by_me' | 'adopted_by_others'
        """
        if not sheep_id:
            raise CommerceError('缺少羊只ID参数')

        try:
            sheep = Sheep.objects.get(pk=sheep_id)
        except Sheep.DoesNotExist:
            raise CommerceError('羊只不存在', code=404, http_status=404)

        # 获取当前用户（如果已登录）
        current_user = None
        if token:
            try:
                current_user = UserService.get_user_by_token(token)
            except Exception:
                pass

        # 检查是否在订单中（已被购买/领养，含配送中）
        adopted_order_item = OrderItem.objects.filter(
            sheep=sheep,
            order__status__in=['paid', 'shipping', 'completed']
        ).select_related('order__user').first()

        if adopted_order_item:
            if current_user and adopted_order_item.order.user_id == current_user.id:
                return {'status': 'adopted_by_me', 'status_text': '我已领养'}
            else:
                return {'status': 'adopted_by_others', 'status_text': '已被领养'}

        # 检查是否在当前用户的购物车中
        if current_user:
            in_cart = CartItem.objects.filter(user=current_user, sheep=sheep).exists()
            if in_cart:
                return {'status': 'in_my_cart', 'status_text': '已在购物车中'}

        return {'status': 'available', 'status_text': '可领养'}

    # ========================
    #  结算 & 订单
    # ========================

    @staticmethod
    def checkout(token, payment_method='balance',
                 receiver_name=None, receiver_phone=None, shipping_address=None,
                 user_coupon_id=None):
        """
        购物车结算：将购物车所有商品打包为一笔订单，清空购物车
        :param token: 用户 JWT token
        :param payment_method: 支付方式 'balance' 或 'wechat'
        :param receiver_name: 收货人姓名
        :param receiver_phone: 收货人手机号
        :param shipping_address: 收货地址
        :param user_coupon_id: 用户优惠券ID（可选）
        :return: dict 订单信息
        """
        user = CommerceService._resolve_user(token)

        # 获取购物车商品
        cart_items = CartItem.objects.filter(user=user).select_related('sheep')
        if not cart_items.exists():
            raise CommerceError('购物车为空，无法结算')

        # 计算总金额
        total_amount = Decimal('0')
        for item in cart_items:
            total_amount += item.price * item.quantity

        # 处理优惠券
        discount_amount = Decimal('0')
        used_coupon = None

        if user_coupon_id:
            try:
                uc = UserCoupon.objects.select_related('coupon').get(pk=user_coupon_id, user=user)
                if uc.status != 'unused':
                    raise CommerceError('优惠券已使用或已过期')
                
                # 检查有效期
                if uc.coupon.valid_until < timezone.now():
                    uc.status = 'expired'
                    uc.save()
                    raise CommerceError('优惠券已过期')
                
                coupon = uc.coupon
                
                # 统计适用金额
                applicable_amount = Decimal('0')
                if coupon.owner:
                    # 养殖户优惠券：仅限该养殖户的商品
                    for item in cart_items:
                        if item.sheep.owner_id == coupon.owner_id:
                            applicable_amount += item.price * item.quantity
                    
                    if applicable_amount == Decimal('0'):
                        owner_name = coupon.owner.nickname or coupon.owner.username
                        raise CommerceError(f'该优惠券仅限 {owner_name} 的商品使用')
                else:
                    # 平台通用券
                    applicable_amount = total_amount

                # 校验门槛
                if applicable_amount < coupon.min_purchase_amount:
                    raise CommerceError(f'未满足使用门槛 (满 {coupon.min_purchase_amount} 元可用)')
                
                # 计算优惠金额
                current_discount = Decimal('0')
                if coupon.coupon_type == 'discount': # 满减
                    current_discount = coupon.discount_amount if coupon.discount_amount else Decimal('0')
                elif coupon.coupon_type == 'percentage': # 折扣
                    if coupon.discount_rate:
                        rate = Decimal(str(coupon.discount_rate))
                        current_discount = applicable_amount * (Decimal('1') - rate)
                    
                    if coupon.max_discount_amount and current_discount > coupon.max_discount_amount:
                        current_discount = coupon.max_discount_amount
                elif coupon.coupon_type == 'cash': # 现金券
                    current_discount = coupon.discount_amount if coupon.discount_amount else Decimal('0')
                
                # 优惠金额不能超过适用金额
                if current_discount > applicable_amount:
                    current_discount = applicable_amount
                
                discount_amount = current_discount
                used_coupon = uc
                
            except UserCoupon.DoesNotExist:
                raise CommerceError('优惠券不存在或不属于您')

        final_amount = total_amount - discount_amount
        if final_amount < Decimal('0'):
            final_amount = Decimal('0')

        # 处理支付逻辑
        if payment_method == 'balance':
            if user.balance < final_amount:
                raise CommerceError('余额不足，请充值或选择其他支付方式')
            
            # 扣除余额
            user.balance -= final_amount
            user.save(update_fields=['balance'])
            
            order_status = 'paid'
            pay_time = timezone.now()
        elif payment_method == 'wechat':
            # 微信支付暂时不扣款，标记为 pending
            order_status = 'pending'
            pay_time = None
        else:
            raise CommerceError('不支持的支付方式')

        # 生成订单编号
        order_no = f"ORD-{uuid.uuid4().hex[:12].upper()}"

        # 创建订单
        order = Order.objects.create(
            user=user,
            order_no=order_no,
            total_amount=final_amount,
            status=order_status,
            pay_time=pay_time,
            receiver_name=receiver_name,
            receiver_phone=receiver_phone,
            shipping_address=shipping_address,
        )

        # 更新优惠券状态
        if used_coupon:
            used_coupon.status = 'used'
            used_coupon.used_at = timezone.now()
            used_coupon.order_id = order.id
            used_coupon.save()

        # 创建订单明细
        for item in cart_items:
            OrderItem.objects.create(
                order=order,
                sheep=item.sheep,
                price=item.price,
            )

        # 清空购物车
        cart_items.delete()

        return CommerceService._build_order(order)

    @staticmethod
    def get_my_sheep(token):
        """
        获取用户已购买的羊（通过已支付/已完成的订单）
        :param token: 用户 JWT token
        :return: list[dict]
        """
        user = CommerceService._resolve_user(token)

        # 查询已支付/配送中/已完成的订单明细
        order_items = OrderItem.objects.filter(
            order__user=user,
            order__status__in=['paid', 'shipping', 'completed']
        ).select_related('sheep', 'order').order_by('-order__created_at')

        result = []
        for oi in order_items:
            sheep = oi.sheep
            result.append({
                'id': oi.id,
                'order_no': oi.order.order_no,
                'order_status': oi.order.get_status_display(),
                'order_status_key': oi.order.status,  # 原始英文key，供前端样式用
                'price': float(oi.price),
                'pay_time': oi.order.pay_time.strftime('%Y-%m-%d %H:%M') if oi.order.pay_time else '',
                'sheep': {
                    'id': sheep.id,
                    'ear_tag': sheep.ear_tag,
                    'gender': sheep.get_gender_display(),
                    'weight': float(sheep.weight),
                    'height': float(sheep.height),
                    'length': float(sheep.length),
                    'price': float(sheep.price),
                    'image': sheep.image.url if sheep.image else '',
                },
            })
        return result

    @staticmethod
    def get_order_history(token):
        """
        获取用户全部订单历史（所有状态）
        :param token: 用户 JWT token
        :return: list[dict]
        """
        user = CommerceService._resolve_user(token)

        orders = Order.objects.filter(user=user).order_by('-created_at')

        result = []
        for order in orders:
            items = order.items.select_related('sheep').all()
            result.append({
                'id': order.id,
                'order_no': order.order_no,
                'total_amount': float(order.total_amount),
                'status': order.status,
                'status_display': order.get_status_display(),
                'pay_time': order.pay_time.strftime('%Y-%m-%d %H:%M') if order.pay_time else '',
                'created_at': order.created_at.strftime('%Y-%m-%d %H:%M') if order.created_at else '',
                'items': [{
                    'sheep_id': oi.sheep.id,
                    'ear_tag': oi.sheep.ear_tag,
                    'gender': oi.sheep.get_gender_display(),
                    'weight': float(oi.sheep.weight),
                    'price': float(oi.price),
                } for oi in items],
            })
        return result

    # ========================
    #  养殖户订单管理
    # ========================

    @staticmethod
    def get_breeder_orders(token):
        """
        获取养殖户的订单列表（用户发起的领养申请）
        :param token: 养殖户 JWT token
        :return: list[dict]
        """
        breeder = CommerceService._resolve_user(token)
        
        # 检查是否为养殖户
        if breeder.role != 1:
            raise CommerceError('只有养殖户可以查看订单', code=403, http_status=403)
        
        # 获取养殖户羊只的订单
        sheep_ids = Sheep.objects.filter(owner=breeder).values_list('id', flat=True)
        order_items = OrderItem.objects.filter(
            sheep_id__in=sheep_ids
        ).select_related('order__user', 'sheep').order_by('-order__created_at')
        
        result = []
        for oi in order_items:
            order = oi.order
            result.append({
                'id': order.id,
                'order_no': order.order_no,
                'total_amount': float(order.total_amount),
                'status': order.status,
                'status_display': order.get_status_display(),
                'created_at': order.created_at.strftime('%Y-%m-%d %H:%M') if order.created_at else '',
                'user': {
                    'id': order.user.id,
                    'nickname': order.user.nickname or order.user.username,
                    'mobile': order.user.mobile or '',
                },
                'sheep': {
                    'id': oi.sheep.id,
                    'ear_tag': oi.sheep.ear_tag,
                    'gender': oi.sheep.get_gender_display(),
                    'weight': float(oi.sheep.weight),
                    'price': float(oi.price),
                },
            })
        return result

    @staticmethod
    def update_order_status(token, order_id, status, logistics_info=None):
        """
        更新订单状态（确认或拒绝领养请求，更新发货状态等）
        :param token: 养殖户 JWT token
        :param order_id: 订单ID
        :param status: 新状态 ('paid', 'shipping', 'completed', 'cancelled')
        :param logistics_info: 物流信息 dict，包含 logistics_company, logistics_tracking_number
        :return: dict
        """
        from django.utils import timezone
        
        breeder = CommerceService._resolve_user(token)
        
        # 检查是否为养殖户
        if breeder.role != 1:
            raise CommerceError('只有养殖户可以更新订单状态', code=403, http_status=403)
        
        # 获取订单
        try:
            order = Order.objects.get(pk=order_id)
        except Order.DoesNotExist:
            raise CommerceError('订单不存在', code=404, http_status=404)
        
        # 检查订单是否包含养殖户的羊只
        order_items = order.items.select_related('sheep').all()
        sheep_ids = [oi.sheep.id for oi in order_items]
        breeder_sheep_ids = Sheep.objects.filter(owner=breeder).values_list('id', flat=True)
        
        if not any(sheep_id in breeder_sheep_ids for sheep_id in sheep_ids):
            raise CommerceError('无权操作此订单', code=403, http_status=403)
        
        # 更新订单状态
        valid_statuses = ['paid', 'shipping', 'completed', 'cancelled']
        if status not in valid_statuses:
            raise CommerceError(f'无效的状态值，可选: {", ".join(valid_statuses)}')
        
        order.status = status
        
        # 处理发货状态
        if status == 'shipping':
            if logistics_info:
                order.logistics_company = logistics_info.get('logistics_company')
                order.logistics_tracking_number = logistics_info.get('logistics_tracking_number')
            order.shipping_date = timezone.now()
        
        # 处理完成状态
        elif status == 'completed' and not order.delivery_date:
            order.delivery_date = timezone.now()
        
        order.save()
        
        return CommerceService._build_order(order)

    # ========================
    #  私有方法
    # ========================

    @staticmethod
    def _resolve_user(token):
        """通过 token 获取用户对象（复用 UserService 的 token 验证逻辑）"""
        try:
            return UserService.get_user_by_token(token)
        except UserError as e:
            raise CommerceError(e.message, code=e.code, http_status=e.http_status)

    @staticmethod
    def _build_cart_item(item):
        """构建购物车项的返回数据"""
        sheep = item.sheep
        return {
            'id': item.id,
            'sheep_id': sheep.id,
            'sheep': {
                'id': sheep.id,
                'ear_tag': sheep.ear_tag,
                'gender': sheep.get_gender_display(),
                'weight': float(sheep.weight),
                'height': float(sheep.height),
                'length': float(sheep.length),
                'price': float(sheep.price),
                'image': sheep.image.url if sheep.image else '',
                'owner_id': sheep.owner_id,  # 新增
            },
            'quantity': item.quantity,
            'price': float(item.price),
            'created_at': item.created_at.strftime('%Y-%m-%d %H:%M:%S') if item.created_at else '',
        }

    @staticmethod
    def _build_order(order):
        """构建订单的返回数据"""
        items = order.items.select_related('sheep').all()
        return {
            'id': order.id,
            'order_no': order.order_no,
            'total_amount': float(order.total_amount),
            'status': order.status,
            'status_display': order.get_status_display(),
            'pay_time': order.pay_time.strftime('%Y-%m-%d %H:%M:%S') if order.pay_time else '',
            'shipping_date': order.shipping_date.strftime('%Y-%m-%d %H:%M:%S') if order.shipping_date else '',
            'delivery_date': order.delivery_date.strftime('%Y-%m-%d %H:%M:%S') if order.delivery_date else '',
            'logistics_company': order.logistics_company or '',
            'logistics_tracking_number': order.logistics_tracking_number or '',
            'receiver_name': order.receiver_name or '',
            'receiver_phone': order.receiver_phone or '',
            'shipping_address': order.shipping_address or '',
            'user_balance': float(order.user.balance),  # 支付后最新余额，前端用于更新缓存
            'created_at': order.created_at.strftime('%Y-%m-%d %H:%M:%S') if order.created_at else '',
            'items': [{
                'sheep_id': oi.sheep.id,
                'ear_tag': oi.sheep.ear_tag,
                'gender': oi.sheep.get_gender_display(),
                'weight': float(oi.sheep.weight),
                'price': float(oi.price),
            } for oi in items],
        }

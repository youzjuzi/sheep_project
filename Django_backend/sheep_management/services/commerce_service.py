"""
商业模块业务逻辑 Service
购物车增删改查 + 结算下单 + 我的羊查询
所有方法为纯业务逻辑，不依赖任何 HTTP Request/Response 对象。
"""
import uuid
from decimal import Decimal
from django.utils import timezone

from ..models import CartItem, Sheep, Order, OrderItem
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

        # 检查是否在订单中（已被购买/领养）
        adopted_order_item = OrderItem.objects.filter(
            sheep=sheep,
            order__status__in=['paid', 'completed']
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
    def checkout(token):
        """
        购物车结算：将购物车所有商品打包为一笔订单，清空购物车
        :param token: 用户 JWT token
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

        # 生成订单编号
        order_no = f"ORD-{uuid.uuid4().hex[:12].upper()}"

        # 创建订单（目前没有真实支付，直接标记为已支付）
        order = Order.objects.create(
            user=user,
            order_no=order_no,
            total_amount=total_amount,
            status='paid',
            pay_time=timezone.now(),
        )

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

        # 查询已支付或已完成的订单明细
        order_items = OrderItem.objects.filter(
            order__user=user,
            order__status__in=['paid', 'completed']
        ).select_related('sheep', 'order').order_by('-order__created_at')

        result = []
        for oi in order_items:
            sheep = oi.sheep
            result.append({
                'id': oi.id,
                'order_no': oi.order.order_no,
                'order_status': oi.order.get_status_display(),
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
            'created_at': order.created_at.strftime('%Y-%m-%d %H:%M:%S') if order.created_at else '',
            'items': [{
                'sheep_id': oi.sheep.id,
                'ear_tag': oi.sheep.ear_tag,
                'gender': oi.sheep.get_gender_display(),
                'weight': float(oi.sheep.weight),
                'price': float(oi.price),
            } for oi in items],
        }

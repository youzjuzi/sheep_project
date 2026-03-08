"""首页视图"""
from django.shortcuts import render
from django.utils import timezone
from django.db.models import Sum, Count
from ..models import Sheep, GrowthRecord, FeedingRecord, VaccinationHistory, User, Order, OrderItem, EnvironmentAlert
from ..permissions import login_required, ROLE_ADMIN, ROLE_BREEDER


@login_required
def index(request):
    """首页工作台 —— 管理员看平台总览，养殖户看自己的工作台"""
    user = request.user

    if user.role == ROLE_ADMIN:
        return _admin_dashboard(request, user)
    else:
        return _breeder_dashboard(request, user)


# ── 管理员仪表盘 ──────────────────────────────────────────────
def _admin_dashboard(request, user):
    """管理员：平台总览数据"""
    today = timezone.now().date()
    month_start = today.replace(day=1)

    # 平台核心数据
    total_users    = User.objects.filter(role=0).count()
    total_breeders = User.objects.filter(role=ROLE_BREEDER).count()
    pending_breeders = User.objects.filter(role=ROLE_BREEDER, is_verified=False).count()
    total_sheep    = Sheep.objects.count()
    total_orders   = Order.objects.count()
    pending_orders = Order.objects.filter(status='paid').count()   # 已付款待发货

    # 全平台未处理环境预警
    alert_count = EnvironmentAlert.objects.filter(is_resolved=False).count()
    environment_alerts = EnvironmentAlert.objects.filter(
        is_resolved=False
    ).select_related('owner').order_by('-created_at')[:5]

    # 最近注册用户（最多 6 个）
    recent_users = User.objects.order_by('-date_joined')[:6]

    # 待审核养殖户
    pending_breeder_list = User.objects.filter(
        role=ROLE_BREEDER, is_verified=False
    ).order_by('-date_joined')[:5]

    # 最近 8 笔订单
    recent_orders = Order.objects.select_related('user').order_by('-created_at')[:8]

    context = {
        'is_admin': True,
        # 统计数字
        'total_users': total_users,
        'total_breeders': total_breeders,
        'pending_breeders': pending_breeders,
        'total_sheep': total_sheep,
        'total_orders': total_orders,
        'pending_orders': pending_orders,
        'alert_count': alert_count,
        # 列表
        'environment_alerts': environment_alerts,
        'recent_users': recent_users,
        'pending_breeder_list': pending_breeder_list,
        'recent_orders': recent_orders,
    }
    return render(request, 'sheep_management/index.html', context)


# ── 养殖户仪表盘 ──────────────────────────────────────────────
def _breeder_dashboard(request, user):
    """养殖户：自己的羊只 / 订单 / 待办"""
    today = timezone.now().date()
    month_start = today.replace(day=1)

    sheep_list = Sheep.objects.filter(owner=user)
    sheep_ids  = sheep_list.values_list('id', flat=True)

    # 该养殖户名下的订单（去重）
    order_qs = Order.objects.filter(
        items__sheep_id__in=sheep_ids
    ).distinct().order_by('-created_at')

    # 本月营收（该养殖户名下的羊只被购买且订单已完成）
    # 注意：这里按 OrderItem 统计，因为一笔订单可能包含多个养殖户的羊（虽然业务上不太可能，但这样更严谨）
    monthly_revenue = (
        OrderItem.objects.filter(
            sheep__owner=user,
            order__status='completed',
            order__created_at__date__gte=month_start
        )
        .aggregate(total=Sum('price'))['total'] or 0
    )

    # 1. 待发货订单
    pending_shipping_count = order_qs.filter(status='paid').count()

    # 2. 即将到期疫苗（30天内，且未过期）
    upcoming_vaccinations = []
    for sheep in sheep_list:
        for vac in VaccinationHistory.objects.filter(sheep=sheep).order_by('-vaccination_date')[:5]:
            if vac.expiry_date:
                days_left = (vac.expiry_date - today).days
                if 0 <= days_left <= 30:
                    upcoming_vaccinations.append({
                        'sheep': sheep,
                        'vaccine': vac.vaccine,
                        'expiry_date': vac.expiry_date,
                        'days_left': days_left,
                    })

    # 3. 本人的环境预警
    environment_alerts = EnvironmentAlert.objects.filter(
        owner=user, is_resolved=False
    ).order_by('-created_at')[:5]

    context = {
        'is_admin': False,
        'monthly_revenue': monthly_revenue,
        'sheep_count': sheep_list.count(),
        'order_count': order_qs.count(),
        'sheep_list': sheep_list.order_by('-id')[:5],
        'recent_orders': order_qs[:5],
        'pending_shipping_count': pending_shipping_count,
        'upcoming_vaccination_count': len(upcoming_vaccinations),
        'upcoming_vaccinations': upcoming_vaccinations[:3],
        'alert_count': environment_alerts.count(),
        'environment_alerts': environment_alerts,
    }
    return render(request, 'sheep_management/index.html', context)

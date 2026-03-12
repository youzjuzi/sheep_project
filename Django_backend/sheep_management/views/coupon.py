"""
优惠券管理视图（管理员看全局，养殖户管理自己的）
"""
import uuid
import json
from datetime import datetime, timedelta

from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.utils import timezone
from django.views.decorators.http import require_http_methods
from django.db.models import Q, Count
from django.core.paginator import Paginator

from ..models import Coupon, UserCoupon, PromotionActivity, User
from ..permissions import ROLE_ADMIN, ROLE_BREEDER


@login_required
def coupon_list(request):
    """优惠券列表 — 管理员看全部，养殖户只看自己的"""
    is_admin = request.user.role == ROLE_ADMIN
    page_number = request.GET.get('page', 1)
    
    status_filter = request.GET.get('status', '')
    coupon_type_filter = request.GET.get('coupon_type', '')
    search = request.GET.get('search', '')
    owner_filter = request.GET.get('owner', '')

    # 基础查询
    if is_admin:
        coupons = Coupon.objects.select_related('owner').all()
    else:
        coupons = Coupon.objects.filter(owner=request.user)

    if status_filter:
        coupons = coupons.filter(status=status_filter)
    if coupon_type_filter:
        coupons = coupons.filter(coupon_type=coupon_type_filter)
    if search:
        coupons = coupons.filter(Q(name__icontains=search) | Q(code__icontains=search))
    if is_admin and owner_filter:
        coupons = coupons.filter(owner_id=int(owner_filter))

    coupons = coupons.order_by('-created_at')
    paginator = Paginator(coupons, 10)
    page_obj = paginator.get_page(page_number)
    current_coupons = list(page_obj.object_list)

    # 自动标记过期优惠券
    now = timezone.now()
    expired_qs = Coupon.objects.filter(valid_until__lt=now, status='active')
    if not is_admin:
        expired_qs = expired_qs.filter(owner=request.user)
    expired_qs.update(status='expired')

    # 统计信息（范围跟随角色）
    base_qs = Coupon.objects.all() if is_admin else Coupon.objects.filter(owner=request.user)
    base_uc = UserCoupon.objects.all() if is_admin else UserCoupon.objects.filter(coupon__owner=request.user)
    stats = {
        'total': base_qs.count(),
        'active': base_qs.filter(status='active').count(),
        'expired': base_qs.filter(status='expired').count(),
        'total_claimed': base_uc.count(),
        'total_used': base_uc.filter(status='used').count(),
    }

    # 为每个优惠券添加领取统计
    for coupon in current_coupons:
        coupon.claimed_count = UserCoupon.objects.filter(coupon=coupon).count()
        coupon.actual_used_count = UserCoupon.objects.filter(coupon=coupon, status='used').count()
        if coupon.total_count:
            coupon.remaining = coupon.total_count - coupon.claimed_count
        else:
            coupon.remaining = '不限'

    query_params = request.GET.copy()
    query_params.pop('page', None)
    extra_query = query_params.urlencode()
    extra_query = f'&{extra_query}' if extra_query else ''

    # 管理员需要养殖户列表
    breeders = []
    if is_admin:
        breeders = User.objects.filter(role=ROLE_BREEDER, is_verified=True).order_by('id')

    context = {
        'coupons': current_coupons,
        'page_obj': page_obj,
        'extra_query': extra_query,
        'stats': stats,
        'status_filter': status_filter,
        'coupon_type_filter': coupon_type_filter,
        'search': search,
        'owner_filter': owner_filter,
        'is_admin': is_admin,
        'breeders': breeders,
    }
    return render(request, 'sheep_management/coupon/coupon_list.html', context)


@login_required
def coupon_create(request):
    """创建优惠券"""
    is_admin = request.user.role == ROLE_ADMIN

    if request.method == 'POST':
        try:
            name = request.POST.get('name', '').strip()
            code = request.POST.get('code', '').strip()
            coupon_type = request.POST.get('coupon_type', 'discount')
            description = request.POST.get('description', '').strip()
            discount_amount = request.POST.get('discount_amount')
            discount_rate = request.POST.get('discount_rate')
            min_purchase_amount = request.POST.get('min_purchase_amount', '0')
            max_discount_amount = request.POST.get('max_discount_amount')
            total_count = request.POST.get('total_count')
            user_limit = request.POST.get('user_limit', '1')
            valid_from = request.POST.get('valid_from')
            valid_until = request.POST.get('valid_until')
            status = request.POST.get('status', 'active')

            if not name:
                messages.error(request, '优惠券名称不能为空')
                return redirect('coupon_create')

            # 确定所属养殖户
            if is_admin:
                owner_id = request.POST.get('owner')
                if not owner_id:
                    messages.error(request, '请选择所属养殖户')
                    return redirect('coupon_create')
                owner = get_object_or_404(User, pk=int(owner_id), role=ROLE_BREEDER)
            else:
                owner = request.user

            # 自动生成优惠券代码
            if not code:
                code = f"CPN-{uuid.uuid4().hex[:8].upper()}"

            coupon = Coupon(
                name=name,
                code=code,
                coupon_type=coupon_type,
                description=description,
                status=status,
                min_purchase_amount=float(min_purchase_amount) if min_purchase_amount else 0,
                user_limit=int(user_limit) if user_limit else 1,
                owner=owner,
            )

            if discount_amount:
                coupon.discount_amount = float(discount_amount)
            if discount_rate:
                coupon.discount_rate = float(discount_rate) / 10
            if max_discount_amount:
                coupon.max_discount_amount = float(max_discount_amount)
            if total_count:
                coupon.total_count = int(total_count)
            if valid_from:
                coupon.valid_from = datetime.strptime(valid_from, '%Y-%m-%dT%H:%M')
            else:
                coupon.valid_from = timezone.now()
            if valid_until:
                coupon.valid_until = datetime.strptime(valid_until, '%Y-%m-%dT%H:%M')
            else:
                coupon.valid_until = timezone.now() + timedelta(days=30)

            coupon.save()
            messages.success(request, f'优惠券"{name}"创建成功！')
            return redirect('coupon_list')

        except Exception as e:
            messages.error(request, f'创建失败：{str(e)}')
            return redirect('coupon_create')

    # 管理员需要养殖户列表
    breeders = []
    if is_admin:
        breeders = User.objects.filter(role=ROLE_BREEDER, is_verified=True).order_by('id')

    return render(request, 'sheep_management/coupon/coupon_form.html', {
        'is_edit': False,
        'coupon': None,
        'is_admin': is_admin,
        'breeders': breeders,
    })


@login_required
def coupon_edit(request, pk):
    """编辑优惠券"""
    coupon = get_object_or_404(Coupon, pk=pk)
    is_admin = request.user.role == ROLE_ADMIN

    # 权限检查：养殖户只能编辑自己的
    if not is_admin and coupon.owner != request.user:
        messages.error(request, '无权编辑该优惠券')
        return redirect('coupon_list')

    if request.method == 'POST':
        try:
            coupon.name = request.POST.get('name', '').strip()
            coupon.coupon_type = request.POST.get('coupon_type', 'discount')
            coupon.description = request.POST.get('description', '').strip()
            coupon.status = request.POST.get('status', 'active')
            coupon.min_purchase_amount = float(request.POST.get('min_purchase_amount', '0') or '0')
            coupon.user_limit = int(request.POST.get('user_limit', '1') or '1')

            # 管理员可以转移归属
            if is_admin:
                new_owner_id = request.POST.get('owner')
                if new_owner_id:
                    coupon.owner = get_object_or_404(User, pk=int(new_owner_id), role=ROLE_BREEDER)

            discount_amount = request.POST.get('discount_amount')
            discount_rate = request.POST.get('discount_rate')
            max_discount_amount = request.POST.get('max_discount_amount')
            total_count = request.POST.get('total_count')
            valid_from = request.POST.get('valid_from')
            valid_until = request.POST.get('valid_until')

            if discount_amount:
                coupon.discount_amount = float(discount_amount)
            if discount_rate:
                coupon.discount_rate = float(discount_rate) / 10
            if max_discount_amount:
                coupon.max_discount_amount = float(max_discount_amount)
            else:
                coupon.max_discount_amount = None
            if total_count:
                coupon.total_count = int(total_count)
            else:
                coupon.total_count = None
            if valid_from:
                coupon.valid_from = datetime.strptime(valid_from, '%Y-%m-%dT%H:%M')
            if valid_until:
                coupon.valid_until = datetime.strptime(valid_until, '%Y-%m-%dT%H:%M')

            coupon.save()
            messages.success(request, f'优惠券"{coupon.name}"更新成功！')
            return redirect('coupon_list')

        except Exception as e:
            messages.error(request, f'更新失败：{str(e)}')

    # 为模板准备折扣率
    display_rate = round(coupon.discount_rate * 10, 1) if coupon.discount_rate else ''

    breeders = []
    if is_admin:
        breeders = User.objects.filter(role=ROLE_BREEDER, is_verified=True).order_by('id')

    return render(request, 'sheep_management/coupon/coupon_form.html', {
        'is_edit': True,
        'coupon': coupon,
        'display_rate': display_rate,
        'is_admin': is_admin,
        'breeders': breeders,
    })


@login_required
def coupon_delete(request, pk):
    """删除优惠券"""
    coupon = get_object_or_404(Coupon, pk=pk)
    is_admin = request.user.role == ROLE_ADMIN

    if not is_admin and coupon.owner != request.user:
        messages.error(request, '无权删除该优惠券')
        return redirect('coupon_list')

    name = coupon.name
    coupon.delete()
    messages.success(request, f'优惠券"{name}"已删除')
    return redirect('coupon_list')


@login_required
def coupon_detail(request, pk):
    """优惠券领取详情"""
    coupon = get_object_or_404(Coupon, pk=pk)
    is_admin = request.user.role == ROLE_ADMIN

    if not is_admin and coupon.owner != request.user:
        messages.error(request, '无权查看该优惠券')
        return redirect('coupon_list')

    user_coupons = UserCoupon.objects.filter(coupon=coupon).select_related('user').order_by('-obtained_at')

    context = {
        'coupon': coupon,
        'user_coupons': user_coupons,
        'total_claimed': user_coupons.count(),
        'unused_count': user_coupons.filter(status='unused').count(),
        'used_count': user_coupons.filter(status='used').count(),
        'expired_count': user_coupons.filter(status='expired').count(),
        'is_admin': is_admin,
    }
    return render(request, 'sheep_management/coupon/coupon_detail.html', context)

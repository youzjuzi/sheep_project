"""订单管理视图"""
from django.shortcuts import render, get_object_or_404, redirect
from django.contrib import messages
from django.db.models import Q
from django.core.paginator import Paginator
from ..models import Order, OrderItem
from ..permissions import login_required, ROLE_ADMIN, ROLE_BREEDER


@login_required
def order_list(request):
    """订单列表——管理员看全部，养殖户只看自己名下羊只的订单"""
    user = request.user
    status_filter = request.GET.get('status', '')
    search = request.GET.get('search', '').strip()
    page_number = request.GET.get('page', 1)

    if user.role == ROLE_ADMIN:
        orders = Order.objects.all()
    else:
        # 养殖户：订单里含有自己旗下羊只的才显示
        orders = Order.objects.filter(items__sheep__owner=user).distinct()

    if status_filter:
        orders = orders.filter(status=status_filter)

    if search:
        orders = orders.filter(
            Q(order_no__icontains=search) |
            Q(user__nickname__icontains=search) |
            Q(user__username__icontains=search) |
            Q(user__mobile__icontains=search)
        )

    orders = orders.order_by('-created_at')
    paginator = Paginator(orders, 10)
    page_obj = paginator.get_page(page_number)

    query_params = request.GET.copy()
    query_params.pop('page', None)
    query_string = query_params.urlencode()

    # 各状态计数
    if user.role == ROLE_ADMIN:
        base_qs = Order.objects.all()
    else:
        base_qs = Order.objects.filter(items__sheep__owner=user).distinct()

    stats = {
        'total':     base_qs.count(),
        'pending':   base_qs.filter(status='pending').count(),
        'paid':      base_qs.filter(status='paid').count(),
        'shipping':  base_qs.filter(status='shipping').count(),
        'completed': base_qs.filter(status='completed').count(),
        'cancelled': base_qs.filter(status='cancelled').count(),
    }

    context = {
        'orders': page_obj.object_list,
        'page_obj': page_obj,
        'query_string': query_string,
        'stats': stats,
        'status_filter': status_filter,
        'search': search,
        'is_admin': user.role == ROLE_ADMIN,
    }
    return render(request, 'sheep_management/order/list.html', context)


@login_required
def order_detail(request, pk):
    """订单详情——养殖户只能看自己的"""
    user = request.user
    if user.role == ROLE_ADMIN:
        order = get_object_or_404(Order, pk=pk)
    else:
        order = get_object_or_404(Order, pk=pk, items__sheep__owner=user)

    context = {'order': order, 'is_admin': user.role == ROLE_ADMIN}
    return render(request, 'sheep_management/order/detail.html', context)


@login_required
def order_update_status(request, pk):
    """更新订单状态——养殖户只能操作自己的订单"""
    from django.utils import timezone
    user = request.user

    if user.role == ROLE_ADMIN:
        order = get_object_or_404(Order, pk=pk)
    else:
        order = get_object_or_404(Order, pk=pk, items__sheep__owner=user)

    if request.method == 'POST':
        status = request.POST.get('status')
        order.status = status

        if status == 'shipping':
            order.logistics_company = request.POST.get('logistics_company')
            order.logistics_tracking_number = request.POST.get('logistics_tracking_number')
            order.shipping_date = timezone.now()
        elif status == 'completed' and not order.delivery_date:
            order.delivery_date = timezone.now()

        order.save()
        messages.success(request, '订单状态更新成功！')
        return redirect('order_detail', pk=order.pk)

    context = {'order': order, 'is_admin': user.role == ROLE_ADMIN}
    return render(request, 'sheep_management/order/update_status.html', context)

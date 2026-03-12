"""喂养记录管理视图"""
from django.shortcuts import render, redirect
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.paginator import Paginator
from ..models import Sheep, FeedingRecord
from ..permissions import ROLE_ADMIN


@login_required
def feeding_record_list(request):
    """喂养记录列表 - 按羊只分组，管理员看全部，养殖户只看自己的羊"""
    is_admin = request.user.role == ROLE_ADMIN
    page_number = request.GET.get('page', 1)

    if is_admin:
        sheep_qs = Sheep.objects.all().select_related('owner').order_by('id')
    else:
        sheep_qs = Sheep.objects.filter(owner=request.user).order_by('id')

    # 羊只分组分页（每页 10 只羊）
    paginator = Paginator(sheep_qs, 10)
    page_obj = paginator.get_page(page_number)
    current_sheep = list(page_obj.object_list)

    # 构建当前页按羊只分组的喂养记录
    sheep_feeding_list = []
    for sheep in current_sheep:
        records = FeedingRecord.objects.filter(sheep=sheep).order_by('-feed_date')
        sheep_feeding_list.append({
            'sheep': sheep,
            'records': records,
            'count': records.count(),
        })

    params = request.GET.copy()
    params.pop('page', None)
    query_string = params.urlencode()

    context = {
        'sheep_feeding_list': sheep_feeding_list,
        'is_admin': is_admin,
        'page_obj': page_obj,
        'query_string': query_string,
    }
    return render(request, 'sheep_management/feeding/list.html', context)


@login_required
def feeding_record_create(request):
    """创建喂养记录"""
    is_admin = request.user.role == ROLE_ADMIN

    if request.method == 'POST':
        FeedingRecord.objects.create(
            sheep_id=int(request.POST.get('sheep_id')),
            feed_type=request.POST.get('feed_type'),
            feed_date=request.POST.get('feed_date'),
            amount=float(request.POST.get('amount')),
            unit=request.POST.get('unit'),
        )
        messages.success(request, '喂养记录创建成功！')
        return redirect('feeding_record_list')

    if is_admin:
        sheep_list = Sheep.objects.all().select_related('owner')
    else:
        sheep_list = Sheep.objects.filter(owner=request.user)
    return render(request, 'sheep_management/feeding/form.html', {'title': '创建喂养记录', 'sheep_list': sheep_list})


"""生长记录管理视图"""
import json
from django.shortcuts import render, redirect
from django.contrib import messages
from django.db.models import Prefetch
from django.core.paginator import Paginator
from ..models import Sheep, GrowthRecord
from ..permissions import ROLE_ADMIN


def growth_record_list(request):
    """生长记录列表 - 按羊只分组展示，带权限过滤"""
    is_admin = request.user.role == ROLE_ADMIN
    page_number = request.GET.get('page', 1)

    if is_admin:
        sheep_qs = Sheep.objects.all().select_related('owner').order_by('id')
    else:
        sheep_qs = Sheep.objects.filter(owner=request.user).order_by('id')

    # 预取生长记录，按日期升序（方便折线图）
    sheep_qs = sheep_qs.prefetch_related(
        Prefetch(
            'growth_records',
            queryset=GrowthRecord.objects.order_by('record_date'),
            to_attr='sorted_growth_records'
        )
    )

    # 只展示有生长记录的羊
    sheep_with_records = [s for s in sheep_qs if s.sorted_growth_records]
    total_count = sum(len(s.sorted_growth_records) for s in sheep_with_records)

    # 羊只分组分页（每页10只羊）
    paginator = Paginator(sheep_with_records, 10)
    page_obj = paginator.get_page(page_number)
    current_sheep_list = list(page_obj.object_list)

    # 预先序列化图表数据，避免模板中多次迭代及 None/日期格式问题
    chart_data = {}
    for s in current_sheep_list:
        chart_data[str(s.id)] = {
            'labels':  [str(r.record_date) for r in s.sorted_growth_records],
            'weights': [r.weight  for r in s.sorted_growth_records],
            'heights': [r.height  for r in s.sorted_growth_records],
            'lengths': [r.length  for r in s.sorted_growth_records],
        }

    query_params = request.GET.copy()
    query_params.pop('page', None)
    extra_query = query_params.urlencode()
    extra_query = f'&{extra_query}' if extra_query else ''

    context = {
        'sheep_list': current_sheep_list,
        'page_obj': page_obj,
        'extra_query': extra_query,
        'total_count': total_count,
        'is_admin': is_admin,
        'growth_chart_data_json': json.dumps(chart_data, ensure_ascii=False),
    }
    return render(request, 'sheep_management/growth/list.html', context)


def growth_record_create(request):
    """创建生长记录"""
    if request.method == 'POST':
        growth_record = GrowthRecord.objects.create(
            sheep_id=int(request.POST.get('sheep_id')),
            record_date=request.POST.get('record_date'),
            weight=float(request.POST.get('weight')),
            height=float(request.POST.get('height')),
            length=float(request.POST.get('length')),
        )
        messages.success(request, '生长记录创建成功！')
        return redirect('growth_record_list')
    
    sheep_list = Sheep.objects.all()
    return render(request, 'sheep_management/growth/form.html', {'title': '创建生长记录', 'sheep_list': sheep_list})


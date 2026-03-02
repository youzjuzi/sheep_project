"""疫苗接种记录管理视图"""
from django.shortcuts import render, redirect
from django.contrib import messages
from django.contrib.auth.decorators import login_required
import datetime
from ..models import Sheep, VaccinationHistory, VaccineType
from ..permissions import ROLE_ADMIN


@login_required
def vaccination_list(request):
    """疫苗接种记录列表 - 按羊只分组或按疫苗类型筛选"""
    is_admin = request.user.role == ROLE_ADMIN
    search = request.GET.get('search', '').strip()       # 耳标号搜索
    vaccine_id = request.GET.get('vaccine_id', '').strip()  # 疫苗类型筛选
    view_mode = request.GET.get('view', 'sheep')          # sheep / vaccine
    today = datetime.date.today()

    # 基础 queryset
    if is_admin:
        base_qs = VaccinationHistory.objects.all().select_related('sheep', 'vaccine', 'sheep__owner')
    else:
        base_qs = VaccinationHistory.objects.filter(
            sheep__owner=request.user
        ).select_related('sheep', 'vaccine')

    if search:
        base_qs = base_qs.filter(sheep__ear_tag__icontains=search)
    if vaccine_id:
        base_qs = base_qs.filter(vaccine_id=vaccine_id)

    # --- 按羊只分组 ---
    sheep_groups = []
    if view_mode == 'sheep' or not vaccine_id:
        seen = {}
        for r in base_qs.order_by('sheep__ear_tag', '-vaccination_date'):
            sid = r.sheep_id
            if sid not in seen:
                seen[sid] = {'sheep': r.sheep, 'records': [], 'has_expired': False}
            seen[sid]['records'].append(r)
            if r.expiry_date < today:
                seen[sid]['has_expired'] = True
        sheep_groups = list(seen.values())

    # --- 所有疫苗类型（用于筛选下拉）---
    all_vaccines = VaccineType.objects.all().order_by('name')

    context = {
        'sheep_groups': sheep_groups,
        'all_vaccines': all_vaccines,
        'search': search,
        'vaccine_id': vaccine_id,
        'view_mode': view_mode,
        'is_admin': is_admin,
        'today': today,
        'total_count': base_qs.count(),
    }
    return render(request, 'sheep_management/vaccination/list.html', context)


@login_required
def vaccination_create(request):
    """创建疫苗接种记录"""
    is_admin = request.user.role == ROLE_ADMIN

    if request.method == 'POST':
        VaccinationHistory.objects.create(
            vaccine_id=int(request.POST.get('vaccine_id')),
            sheep_id=int(request.POST.get('sheep_id')),
            vaccination_date=request.POST.get('vaccination_date'),
            expiry_date=request.POST.get('expiry_date'),
            dosage=float(request.POST.get('dosage')),
            administered_by=request.POST.get('administered_by'),
            notes=request.POST.get('notes') or None,
        )
        messages.success(request, '疫苗接种记录创建成功！')
        return redirect('vaccination_list')

    # 按角色过滤羊只：管理员看全部，养殖户只看自己的
    if is_admin:
        sheep_list = Sheep.objects.select_related('owner').all().order_by('id')
    else:
        sheep_list = Sheep.objects.filter(owner=request.user).order_by('id')

    vaccine_types = VaccineType.objects.all().order_by('name')

    context = {
        'title': '创建疫苗接种记录',
        'sheep_list': sheep_list,
        'vaccine_types': vaccine_types,
    }
    return render(request, 'sheep_management/vaccination/form.html', context)


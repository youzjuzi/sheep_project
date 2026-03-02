"""养殖户管理视图（养殖户 = role=1 的 User）"""
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.db.models import Q, Count
from ..models import User, Sheep
from ..permissions import admin_required, ROLE_BREEDER


@admin_required
def breeder_list(request):
    """养殖户列表"""
    search = request.GET.get('search', '')
    # 已通过审核的养殖户
    qs = User.objects.filter(role=ROLE_BREEDER).annotate(actual_sheep_count=Count('sheep_list'))

    if search:
        qs = qs.filter(
            Q(nickname__icontains=search) | Q(mobile__icontains=search) | Q(username__icontains=search)
        )

    pending_count = User.objects.filter(role=ROLE_BREEDER, is_verified=False).count()

    context = {
        'breeder_list': qs,
        'search': search,
        'pending_count': pending_count,
    }
    return render(request, 'sheep_management/breeder/list.html', context)


@admin_required
def breeder_detail(request, pk):
    """养殖户详情"""
    breeder = get_object_or_404(User, pk=pk, role=ROLE_BREEDER)
    sheep_list = Sheep.objects.filter(owner=breeder).order_by('id')
    context = {
        'breeder': breeder,
        'sheep_list': sheep_list,
        'actual_sheep_count': sheep_list.count(),
        'actual_female_count': sheep_list.filter(gender=0).count(),
        'actual_male_count': sheep_list.filter(gender=1).count(),
    }
    return render(request, 'sheep_management/breeder/detail.html', context)


@admin_required
def breeder_create(request):
    """创建养殖户（role=1）"""
    if request.method == 'POST':
        username = request.POST.get('username', '').strip()
        password = request.POST.get('password', '').strip()
        nickname = request.POST.get('nickname', '').strip()
        mobile   = request.POST.get('mobile', '').strip()
        is_verified = request.POST.get('is_verified') == 'on'

        if not username or not password:
            messages.error(request, '用户名和密码不能为空')
            return render(request, 'sheep_management/breeder/form.html', {'title': '创建养殖户', 'is_create': True})

        if User.objects.filter(username=username).exists():
            messages.error(request, '用户名已存在，请更换')
            return render(request, 'sheep_management/breeder/form.html', {'title': '创建养殖户', 'is_create': True})

        breeder = User(username=username, nickname=nickname, mobile=mobile, role=ROLE_BREEDER, is_verified=is_verified)
        breeder.set_password(password)
        breeder.save()
        messages.success(request, '养殖户创建成功！')
        return redirect('breeder_detail', pk=breeder.pk)
    return render(request, 'sheep_management/breeder/form.html', {'title': '创建养殖户', 'is_create': True})


@admin_required
def breeder_edit(request, pk):
    """编辑养殖户"""
    breeder = get_object_or_404(User, pk=pk, role=ROLE_BREEDER)
    if request.method == 'POST':
        username = request.POST.get('username', breeder.username).strip()
        new_password = request.POST.get('password', '').strip()

        if username != breeder.username and User.objects.filter(username=username).exists():
            messages.error(request, '用户名已存在，请更换')
            return render(request, 'sheep_management/breeder/form.html', {'breeder': breeder, 'title': '编辑养殖户', 'is_create': False})

        breeder.username    = username
        breeder.nickname    = request.POST.get('nickname', breeder.nickname or '').strip()
        breeder.mobile      = request.POST.get('mobile', breeder.mobile or '').strip()
        breeder.is_verified = request.POST.get('is_verified') == 'on'
        lat = request.POST.get('latitude', '').strip()
        lng = request.POST.get('longitude', '').strip()
        breeder.latitude  = float(lat)  if lat  else None
        breeder.longitude = float(lng) if lng else None
        if new_password:
            breeder.set_password(new_password)
        breeder.save()
        messages.success(request, '养殖户信息更新成功！')
        return redirect('breeder_detail', pk=breeder.pk)
    return render(request, 'sheep_management/breeder/form.html', {'breeder': breeder, 'title': '编辑养殖户', 'is_create': False})


@admin_required
def breeder_delete(request, pk):
    """删除养殖户"""
    breeder = get_object_or_404(User, pk=pk, role=ROLE_BREEDER)
    if request.method == 'POST':
        breeder.delete()
        messages.success(request, '养殖户已删除')
        return redirect('breeder_list')
    return render(request, 'sheep_management/breeder/confirm_delete.html', {'breeder': breeder})

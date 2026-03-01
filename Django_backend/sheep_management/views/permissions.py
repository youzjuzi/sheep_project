"""
权限和角色管理视图（仅限管理员）
"""
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.db.models import Q
from ..models import User
from ..permissions import admin_required, ROLE_BREEDER, ROLE_ADMIN


@admin_required
def breeder_audit_list(request):
    """
    养殖户审核列表 - 显示所有待审核和已审核的养殖户
    仅管理员可访问
    """
    filter_status = request.GET.get('status', 'pending')  # pending / verified / rejected / all
    search = request.GET.get('search', '').strip()
    
    # 基础查询：所有角色为养殖户的用户
    breeders = User.objects.filter(role=ROLE_BREEDER).order_by('-created_at')
    
    # 按状态过滤
    if filter_status == 'pending':
        breeders = breeders.filter(is_verified=False)
    elif filter_status == 'verified':
        breeders = breeders.filter(is_verified=True)
    
    # 搜索
    if search:
        breeders = breeders.filter(
            Q(username__icontains=search) |
            Q(nickname__icontains=search) |
            Q(mobile__icontains=search)
        )
    
    # 统计
    stats = {
        'total': User.objects.filter(role=ROLE_BREEDER).count(),
        'pending': User.objects.filter(role=ROLE_BREEDER, is_verified=False).count(),
        'verified': User.objects.filter(role=ROLE_BREEDER, is_verified=True).count(),
    }
    
    context = {
        'breeders': breeders,
        'stats': stats,
        'filter_status': filter_status,
        'search': search,
    }
    return render(request, 'sheep_management/permissions/breeder_audit_list.html', context)


@admin_required
def breeder_audit_detail(request, pk):
    """
    养殖户审核详情 - 显示单个养殖户的详细信息
    """
    breeder = get_object_or_404(User, pk=pk, role=ROLE_BREEDER)
    
    # 获取相关统计数据
    from ..models import Sheep, Order
    sheep_count = Sheep.objects.filter(owner=breeder).count()
    order_count = Order.objects.filter(user=breeder).count()
    
    context = {
        'breeder': breeder,
        'sheep_count': sheep_count,
        'order_count': order_count,
    }
    return render(request, 'sheep_management/permissions/breeder_audit_detail.html', context)


@admin_required
def breeder_approve(request, pk):
    """
    审核通过养殖户申请
    """
    breeder = get_object_or_404(User, pk=pk, role=ROLE_BREEDER)
    
    if request.method == 'POST':
        breeder.is_verified = True
        breeder.save()
        messages.success(request, f'已批准 {breeder.nickname or breeder.username} 的养殖户申请')
        return redirect('breeder_audit_detail', pk=pk)
    
    return render(request, 'sheep_management/permissions/breeder_approve_confirm.html', {'breeder': breeder})


@admin_required
def breeder_reject(request, pk):
    """
    拒绝养殖户申请
    """
    breeder = get_object_or_404(User, pk=pk, role=ROLE_BREEDER)
    
    if request.method == 'POST':
        reason = request.POST.get('reason', '').strip()
        # 这里可以保存拒绝原因到数据库（需要扩展 User 模型）
        breeder.is_verified = False
        breeder.role = 0  # 改回普通用户
        breeder.save()
        messages.success(request, f'已拒绝 {breeder.nickname or breeder.username} 的养殖户申请')
        return redirect('breeder_audit_list')
    
    return render(request, 'sheep_management/permissions/breeder_reject_confirm.html', {'breeder': breeder})


@admin_required
def role_user_list(request):
    """
    用户角色管理列表 - 查看和修改用户角色
    """
    role_filter = request.GET.get('role', '')  # 0 / 1 / 2 / all
    search = request.GET.get('search', '').strip()
    
    users = User.objects.all().order_by('-created_at')
    
    # 按角色过滤
    if role_filter in ['0', '1', '2']:
        users = users.filter(role=int(role_filter))
    
    # 搜索
    if search:
        users = users.filter(
            Q(username__icontains=search) |
            Q(nickname__icontains=search) |
            Q(mobile__icontains=search)
        )
    
    # 统计
    stats = {
        'total': User.objects.count(),
        'admin': User.objects.filter(role=ROLE_ADMIN).count(),
        'breeder': User.objects.filter(role=ROLE_BREEDER).count(),
        'user': User.objects.filter(role=0).count(),
    }
    
    context = {
        'users': users,
        'stats': stats,
        'role_filter': role_filter,
        'search': search,
        'role_choices': User.ROLE_CHOICES,
    }
    return render(request, 'sheep_management/permissions/role_user_list.html', context)


@admin_required
def role_user_edit(request, pk):
    """
    修改用户角色
    """
    user = get_object_or_404(User, pk=pk)
    
    if request.method == 'POST':
        new_role = int(request.POST.get('role', user.role))
        old_role = user.role
        
        # 不能修改自己的角色
        if user.pk == request.user.pk:
            messages.error(request, '不能修改自己的角色')
            return redirect('role_user_list')
        
        user.role = new_role
        
        # 如果改为养殖户，需要设置待审核状态
        if new_role == ROLE_BREEDER:
            user.is_verified = False
        
        user.save()
        
        from ..models import AuditLog
        AuditLog.objects.create(
            admin=request.user,
            action='role_change',
            target_user=user,
            details=f'角色从 {dict(User.ROLE_CHOICES).get(old_role)} 改为 {dict(User.ROLE_CHOICES).get(new_role)}'
        )
        
        messages.success(request, f'已修改 {user.nickname or user.username} 的角色')
        return redirect('role_user_list')
    
    context = {
        'target_user': user,
        'role_choices': User.ROLE_CHOICES,
    }
    return render(request, 'sheep_management/permissions/role_user_edit.html', context)


@admin_required
def permission_overview(request):
    """
    权限概览 - 显示各个角色的权限列表
    """
    from ..permissions import Permission, ROLE_NAMES
    
    context = {
        'admin_permissions': Permission.ADMIN_PERMISSIONS,
        'breeder_permissions': Permission.BREEDER_PERMISSIONS,
        'user_permissions': Permission.USER_PERMISSIONS,
        'role_names': ROLE_NAMES,
    }
    return render(request, 'sheep_management/permissions/permission_overview.html', context)

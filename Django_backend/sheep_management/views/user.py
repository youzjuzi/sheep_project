"""用户管理视图"""
from django.shortcuts import render, get_object_or_404, redirect
from django.contrib import messages
from django.db.models import Q
from ..models import User
from ..permissions import admin_required


@admin_required
def user_list(request):
    """用户列表"""
    search = request.GET.get('search', '')
    user_list = User.objects.all()
    
    if search:
        user_list = user_list.filter(
            Q(username__icontains=search) | Q(nickname__icontains=search) | Q(openid__icontains=search) | Q(mobile__icontains=search)
        )
    
    context = {'user_list': user_list, 'search': search}
    return render(request, 'sheep_management/user/list.html', context)


@admin_required
def user_detail(request, pk):
    """用户详情"""
    target_user = get_object_or_404(User, pk=pk)
    context = {'target_user': target_user}
    return render(request, 'sheep_management/user/detail.html', context)


@admin_required
def user_create(request):
    """创建用户"""
    if request.method == 'POST':
        username = request.POST.get('username', '').strip()
        password = request.POST.get('password', '').strip()
        nickname = request.POST.get('nickname', '').strip()
        mobile = request.POST.get('mobile', '').strip()
        role = int(request.POST.get('role', 0) or 0)

        if not username or not password:
            messages.error(request, '用户名和密码不能为空')
            return render(request, 'sheep_management/user/form.html', {
                'title': '创建用户',
                'is_create': True,
            })

        if User.objects.filter(username=username).exists():
            messages.error(request, '用户名已存在，请更换')
            return render(request, 'sheep_management/user/form.html', {
                'title': '创建用户',
                'is_create': True,
            })

        user = User(
            username=username,
            nickname=nickname,
            mobile=mobile,
            role=role,
            is_verified=(request.POST.get('is_verified') == 'on')
        )
        user.set_password(password)
        user.save()
        messages.success(request, '用户创建成功！')
        return redirect('user_detail', pk=user.pk)
    return render(request, 'sheep_management/user/form.html', {'target_user': None, 'title': '创建用户', 'is_create': True})


@admin_required
def user_update(request, pk):
    """编辑用户"""
    user = get_object_or_404(User, pk=pk)
    if request.method == 'POST':
        username = request.POST.get('username', user.username).strip()
        nickname = request.POST.get('nickname', user.nickname or '').strip()
        mobile = request.POST.get('mobile', user.mobile or '').strip()
        role = int(request.POST.get('role', user.role) or user.role)
        new_password = request.POST.get('password', '').strip()

        if username != user.username and User.objects.filter(username=username).exists():
            messages.error(request, '用户名已存在，请更换')
            return render(request, 'sheep_management/user/form.html', {'target_user': user, 'title': '编辑用户', 'is_create': False})

        user.username = username
        user.nickname = nickname
        user.mobile = mobile
        user.role = role
        user.is_verified = (request.POST.get('is_verified') == 'on')
        user.description = request.POST.get('description', '').strip() or None

        # 处理头像上传（存入 R2，保存公开 URL）
        avatar_file = request.FILES.get('avatar')
        if avatar_file:
            from storages.backends.s3boto3 import S3Boto3Storage
            from django.conf import settings
            storage = S3Boto3Storage()
            filename = f'avatars/user_{user.pk}_{avatar_file.name}'
            saved_name = storage.save(filename, avatar_file)
            user.avatar_url = f'https://{settings.AWS_S3_CUSTOM_DOMAIN}/{saved_name}'

        if new_password:
            user.set_password(new_password)

        user.save()
        messages.success(request, '用户信息更新成功！')
        return redirect('user_detail', pk=user.pk)
    return render(request, 'sheep_management/user/form.html', {'target_user': user, 'title': '编辑用户', 'is_create': False})


@admin_required
def user_delete(request, pk):
    """删除用户"""
    user = get_object_or_404(User, pk=pk)

    if request.user.pk == user.pk:
        messages.error(request, '不能删除当前登录账号')
        return redirect('user_list')

    if request.method == 'POST':
        user.delete()
        messages.success(request, '用户删除成功！')
        return redirect('user_list')
    return render(request, 'sheep_management/user/confirm_delete.html', {'target_user': user})


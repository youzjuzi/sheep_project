"""
后台登录 / 登出 / 注册视图
"""
from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login, logout
from django.contrib import messages
from ..permissions import ROLE_BREEDER, ROLE_ADMIN
from ..models import User


def login_view(request):
    """后台登录页"""
    if request.user.is_authenticated:
        return redirect('index')

    if request.method == 'POST':
        username = request.POST.get('username', '').strip()
        password = request.POST.get('password', '').strip()

        if not username or not password:
            messages.error(request, '用户名和密码不能为空')
            return render(request, 'sheep_management/login.html', {'username': username})

        user = authenticate(request, username=username, password=password)

        if user is None:
            messages.error(request, '用户名或密码错误')
            return render(request, 'sheep_management/login.html', {'username': username})

        # 仅允许养殖户和管理员登录后台
        if user.role not in (ROLE_BREEDER, ROLE_ADMIN):
            messages.error(request, '您没有权限访问后台，请联系管理员')
            return render(request, 'sheep_management/login.html', {'username': username})

        # 养殖户待审核时拒绝登录
        if user.role == ROLE_BREEDER and not user.is_verified:
            messages.error(request, '您的养殖户申请正在审核中，请耐心等待管理员审核通过后再登录')
            return render(request, 'sheep_management/login.html', {'username': username})

        login(request, user)
        next_url = request.GET.get('next') or 'index'
        return redirect(next_url)

    return render(request, 'sheep_management/login.html')


def logout_view(request):
    """后台登出"""
    logout(request)
    messages.success(request, '已成功退出登录')
    return redirect('login')


def register_view(request):
    """养殖户注册页"""
    if request.user.is_authenticated:
        return redirect('index')

    if request.method == 'POST':
        username = request.POST.get('username', '').strip()
        password = request.POST.get('password', '').strip()
        password2 = request.POST.get('password2', '').strip()
        nickname = request.POST.get('nickname', '').strip()
        mobile = request.POST.get('mobile', '').strip()

        errors = {}
        if not username:
            errors['username'] = '用户名不能为空'
        elif User.objects.filter(username=username).exists():
            errors['username'] = '该用户名已被占用'
        if not password:
            errors['password'] = '密码不能为空'
        elif len(password) < 6:
            errors['password'] = '密码不能少于6个字符'
        elif password != password2:
            errors['password2'] = '两次密码输入不一致'
        if not mobile:
            errors['mobile'] = '手机号不能为空'
        elif len(mobile) < 11:
            errors['mobile'] = '手机号格式不正确'

        if errors:
            return render(request, 'sheep_management/register.html', {
                'errors': errors,
                'form_data': {'username': username, 'nickname': nickname, 'mobile': mobile}
            })

        user = User(
            username=username,
            nickname=nickname or username,
            mobile=mobile,
            role=ROLE_BREEDER,
            is_verified=False,   # 待审核
        )
        user.set_password(password)
        user.save()

        # 保存资质文件（可选）
        for field_name in ('business_license', 'env_protection_doc', 'animal_prevention_cert'):
            if field_name in request.FILES:
                setattr(user, field_name, request.FILES[field_name])
        user.save(update_fields=['business_license', 'env_protection_doc', 'animal_prevention_cert'])

        return render(request, 'sheep_management/register_success.html', {'nickname': nickname or username})

    return render(request, 'sheep_management/register.html')

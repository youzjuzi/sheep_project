"""
权限管理模块
定义两个角色的权限规则和装饰器
"""
from functools import wraps
from django.http import JsonResponse, HttpResponseForbidden
from django.shortcuts import redirect
from .models import User

# ========================
# 角色定义和权限映射
# ========================

ROLE_ADMIN = 2  # 管理员
ROLE_BREEDER = 1  # 养殖户
ROLE_USER = 0  # 普通用户

ROLE_NAMES = {
    0: '普通用户',
    1: '养殖户',
    2: '管理员',
}

# ========================
# 权限规则定义
# ========================

class Permission:
    """权限规则"""
    
    # 管理员权限
    ADMIN_PERMISSIONS = {
        'view_all_users': '查看所有用户',
        'manage_users': '管理用户',
        'audit_breeders': '审核养殖户',
        'view_all_breeder_data': '查看所有养殖户数据',
        'view_all_orders': '查看所有订单',
        'handle_aftersales': '处理售后',
        'manage_system': '系统管理',
    }
    
    # 养殖户权限
    BREEDER_PERMISSIONS = {
        'view_own_data': '查看自己的数据',
        'create_sheep': '创建羊只档案',
        'edit_sheep': '编辑羊只档案',
        'manage_breeder_info': '管理养殖户信息',
        'view_own_orders': '查看自己的订单',
        'mark_shipped': '标记发货',
    }
    
    # 普通用户权限
    USER_PERMISSIONS = {
        'view_own_profile': '查看自己的资料',
        'edit_own_profile': '编辑自己的资料',
        'view_own_orders': '查看自己的订单',
    }
    
    @staticmethod
    def get_user_permissions(user):
        """获取用户拥有的权限列表"""
        if not user:
            return {}
        
        if user.role == ROLE_ADMIN:
            return Permission.ADMIN_PERMISSIONS
        elif user.role == ROLE_BREEDER:
            return Permission.BREEDER_PERMISSIONS
        else:
            return Permission.USER_PERMISSIONS
    
    @staticmethod
    def has_permission(user, permission):
        """检查用户是否有指定权限"""
        if not user:
            return False
        
        permissions = Permission.get_user_permissions(user)
        return permission in permissions
    
    @staticmethod
    def is_admin(user):
        """检查是否为管理员"""
        return user and user.role == ROLE_ADMIN
    
    @staticmethod
    def is_breeder(user):
        """检查是否为养殖户"""
        return user and user.role == ROLE_BREEDER
    
    @staticmethod
    def is_verified_breeder(user):
        """检查是否为已验证的养殖户"""
        return user and user.role == ROLE_BREEDER and user.is_verified


# ========================
# 装饰器
# ========================

def login_required(view_func):
    """登录检查装饰器（Web视图）"""
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        # 从 session 或其他认证方式获取用户
        if not request.user.is_authenticated:
            return redirect('login')
        return view_func(request, *args, **kwargs)
    return wrapper


def admin_required(view_func):
    """管理员权限检查装饰器（Web视图）"""
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return redirect('login')
        if request.user.role != ROLE_ADMIN:
            return HttpResponseForbidden('您没有权限访问此页面')
        return view_func(request, *args, **kwargs)
    return wrapper


def breeder_required(view_func):
    """养殖户权限检查装饰器（Web视图）"""
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return redirect('login')
        if request.user.role != ROLE_BREEDER:
            return HttpResponseForbidden('您没有权限访问此页面')
        return view_func(request, *args, **kwargs)
    return wrapper


def verified_breeder_required(view_func):
    """已验证养殖户权限检查装饰器（Web视图）"""
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return redirect('login')
        if request.user.role != ROLE_BREEDER or not request.user.is_verified:
            return HttpResponseForbidden('您需要是已验证的养殖户才能访问此页面')
        return view_func(request, *args, **kwargs)
    return wrapper


# ========================
# API 装饰器（JSON 响应）
# ========================

def api_login_required(view_func):
    """API 登录检查装饰器"""
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return JsonResponse({
                'code': 401,
                'msg': '请先登录',
                'data': None
            }, status=401)
        return view_func(request, *args, **kwargs)
    return wrapper


def api_admin_required(view_func):
    """API 管理员权限检查装饰器"""
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return JsonResponse({
                'code': 401,
                'msg': '请先登录',
                'data': None
            }, status=401)
        if request.user.role != ROLE_ADMIN:
            return JsonResponse({
                'code': 403,
                'msg': '您没有权限访问此资源',
                'data': None
            }, status=403)
        return view_func(request, *args, **kwargs)
    return wrapper


def api_breeder_required(view_func):
    """API 养殖户权限检查装饰器"""
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return JsonResponse({
                'code': 401,
                'msg': '请先登录',
                'data': None
            }, status=401)
        if request.user.role != ROLE_BREEDER:
            return JsonResponse({
                'code': 403,
                'msg': '您没有权限访问此资源',
                'data': None
            }, status=403)
        return view_func(request, *args, **kwargs)
    return wrapper


def api_verified_breeder_required(view_func):
    """API 已验证养殖户权限检查装饰器"""
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return JsonResponse({
                'code': 401,
                'msg': '请先登录',
                'data': None
            }, status=401)
        if request.user.role != ROLE_BREEDER or not request.user.is_verified:
            return JsonResponse({
                'code': 403,
                'msg': '您需要是已验证的养殖户才能访问此资源',
                'data': None
            }, status=403)
        return view_func(request, *args, **kwargs)
    return wrapper


# ========================
# 权限检查函数
# ========================

def check_permission(user, permission):
    """检查用户权限（通用）"""
    if not user or not user.is_authenticated:
        return False
    return Permission.has_permission(user, permission)


def get_data_visibility(user, owner_id):
    """
    获取数据可见性
    
    :param user: 当前用户
    :param owner_id: 数据拥有者 ID
    :return: bool 用户是否可以看到这条数据
    """
    if not user or not user.is_authenticated:
        return False
    
    # 管理员可以看所有数据
    if user.role == ROLE_ADMIN:
        return True
    
    # 养殖户只能看自己的数据
    if user.role == ROLE_BREEDER:
        return user.id == owner_id
    
    # 普通用户只能看自己的数据
    return user.id == owner_id


def filter_accessible_data(user, queryset, owner_field='user'):
    """
    根据权限过滤数据集
    
    :param user: 当前用户
    :param queryset: Django QuerySet
    :param owner_field: 所有者字段名（如 'user', 'breeder'）
    :return: 过滤后的 QuerySet
    """
    if not user or not user.is_authenticated:
        return queryset.none()
    
    # 管理员可以看所有数据
    if user.role == ROLE_ADMIN:
        return queryset
    
    # 养殖户和普通用户只能看自己的数据
    filter_kwargs = {owner_field: user}
    return queryset.filter(**filter_kwargs)

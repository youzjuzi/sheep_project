"""
视图模块 - 统一导出所有视图
认证相关 API 已迁移到 api/auth_api.py
羊只相关 API 已迁移到 api/sheep_api.py
"""
from .index import index
from .sheep import (
    sheep_list, sheep_detail, sheep_create, sheep_edit, sheep_delete,
    sheep_add_growth, sheep_delete_growth,
    sheep_add_feeding, sheep_delete_feeding,
    sheep_add_vaccination, sheep_delete_vaccination,
    resolve_alert
)
from .breeder import breeder_list, breeder_detail, breeder_create, breeder_edit, breeder_delete
from .growth import growth_record_list, growth_record_create
from .feeding import feeding_record_list, feeding_record_create
from .vaccination import vaccination_list, vaccination_create
from .user import user_list, user_detail, user_create, user_update, user_delete
from .order import order_list, order_detail, order_update_status
from .coupon import coupon_list, coupon_create, coupon_edit, coupon_delete, coupon_detail
from .permissions import (
    breeder_audit_list, breeder_audit_detail, breeder_approve, breeder_reject,
    role_user_list, role_user_edit, permission_overview
)
from .views import api_get_breeders, api_search_goods, api_health
from .cart_api import api_cart, api_cart_item
from .promotion_api import api_promotion_activities, api_promotion_activity_detail, api_coupons, api_claim_coupon
from .qa_api import api_qa_ask
from .breeder_dashboard import breeder_dashboard, breeder_profile
from .smart_farm import smart_farm
from .auth import login_view, logout_view, register_view

__all__ = [
    'index',
    'sheep_list', 'sheep_detail', 'sheep_create', 'sheep_edit', 'sheep_delete',
    'sheep_add_growth', 'sheep_delete_growth',
    'sheep_add_feeding', 'sheep_delete_feeding',
    'sheep_add_vaccination', 'sheep_delete_vaccination',
    'resolve_alert',
    'breeder_list', 'breeder_detail', 'breeder_create', 'breeder_edit', 'breeder_delete',
    'growth_record_list', 'growth_record_create',
    'feeding_record_list', 'feeding_record_create',
    'vaccination_list', 'vaccination_create',
    'user_list', 'user_detail', 'user_create', 'user_update', 'user_delete',
    'order_list', 'order_detail', 'order_update_status',
    'breeder_audit_list', 'breeder_audit_detail', 'breeder_approve', 'breeder_reject',
    'role_user_list', 'role_user_edit', 'permission_overview',
    'coupon_list', 'coupon_create', 'coupon_edit', 'coupon_delete', 'coupon_detail',
    'breeder_dashboard', 'breeder_profile',
    'smart_farm',
    'login_view', 'logout_view', 'register_view',
    'api_get_breeders',
    'api_search_goods',
    'api_health',
    'api_cart',
    'api_cart_item',
    'api_promotion_activities',
    'api_promotion_activity_detail',
    'api_coupons',
    'api_claim_coupon',
    'api_qa_ask',
]

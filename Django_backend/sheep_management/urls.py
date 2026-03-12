from django.urls import path
from . import views  # 传统视图 + 其余 API（后续逐步迁移）
from .api import auth_api  # 认证 API（已重构）
from .api import user_api  # 用户 API
from .api import sheep_api  # 羊只 API（已重构）
from .api import commerce_api  # 商业模块 API（购物车）
from . import views  # 复用旧视图中的工具接口

urlpatterns = [
    # ==========================
    # 后台登录 / 登出
    # ==========================
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),
    path('register/', views.register_view, name='register'),

    # ==========================
    # 认证接口（已迁移到 api/auth_api.py）
    # ==========================

    # 1. 手机号一键登录
    path('api/auth/login_by_phone', auth_api.api_login_by_phone, name='api_login_by_phone'),

    # 2. 微信静默登录
    path('api/auth/login', auth_api.api_login_wx, name='api_login_wx'),
    
    # 3. 用户名密码登录
    path('api/auth/login_password', auth_api.api_login, name='api_login_password'),

    # 4. 用户注册
    path('api/auth/register', auth_api.api_register, name='api_register'),

    # Token 验证
    path('api/auth/check_token', auth_api.api_check_token, name='api_check_token_new'),
    path('check_token', auth_api.api_check_token, name='api_check_token'),

    # ==========================
    # 用户接口（api/user_api.py）
    # ==========================
    path('api/user/info', user_api.api_user_info, name='api_user_info'),
    path('api/user/avatar/upload-url', user_api.api_get_avatar_upload_url, name='api_get_avatar_upload_url'),
    path('api/user/avatar/confirm', user_api.api_confirm_avatar, name='api_confirm_avatar'),
    path('api/user/profile', user_api.api_get_profile, name='api_get_profile'),
    path('api/user/profile_update', user_api.api_update_profile, name='api_update_profile'),
    path('api/user/apply_breeder', user_api.api_apply_breeder, name='api_apply_breeder'),
    path('api/user/recharge', user_api.api_recharge, name='api_user_recharge'),

    # ==========================
    # 其他业务接口
    # ==========================
    path('', views.index, name='index'),

    # 羊只API（已迁移到 api/sheep_api.py）
    path('api/sheep/search', sheep_api.api_search_sheep, name='api_search_sheep'),
    path('search_sheep', sheep_api.api_search_sheep, name='search_sheep_compat'),
    
    # 定制领养筛选API（支持多选）
    path('api/sheep/count', sheep_api.api_count_sheep, name='api_count_sheep'),
    path('api/sheep/search-multi', sheep_api.api_search_sheep_multi, name='api_search_sheep_multi'),
    path('api/sheep/<int:sheep_id>', sheep_api.api_get_sheep_by_id, name='api_get_sheep_by_id'),
    path('search_sheep_by_id', sheep_api.api_get_sheep_by_id, name='search_sheep_by_id_compat'),

    # 疫苗记录API（已迁移到 api/sheep_api.py）
    path('api/vaccine/records/<int:sheep_id>', sheep_api.api_get_vaccine_records, name='api_get_vaccine_records'),
    path('vaccine_records/<int:sheep_id>', sheep_api.api_get_vaccine_records, name='vaccine_records_compat'),

    # 养殖户API
    path('api/breeders', views.api_get_breeders, name='api_get_breeders'),
    path('api/breeders/<int:breeder_id>', views.api_get_breeders, name='api_get_breeder_detail'),
    path('breeders', views.api_get_breeders, name='breeders_compat'),
    path('breeders/<int:breeder_id>', views.api_get_breeders, name='breeders_detail_compat'),
    path('api/breeders/follow', views.api_breeder_follow, name='api_breeder_follow'),
    path('api/breeders/unfollow', views.api_breeder_unfollow, name='api_breeder_unfollow'),
    path('api/breeders/follows', views.api_breeder_follows, name='api_breeder_follows'),

    # 商品搜索
    path('search_goods', views.api_search_goods, name='api_search_goods'),

    # 生长记录（已迁移到 api/sheep_api.py）
    path('api/growth/sheep/<int:sheep_id>', sheep_api.api_get_sheep_with_growth, name='api_get_sheep_with_growth'),

    # 智能问答
    path('api/qa/ask', views.api_qa_ask, name='api_qa_ask'),
    
    # 溯源查询（已迁移到 api/sheep_api.py）
    path('api/sheep/trace', sheep_api.api_get_sheep_by_ear_tag, name='api_get_sheep_by_ear_tag'),

    # 养殖户羊只管理接口
    path('api/sheep/create', sheep_api.api_create_sheep, name='api_create_sheep'),
    path('api/sheep/update/<int:sheep_id>', sheep_api.api_update_sheep, name='api_update_sheep'),
    path('api/sheep/delete/<int:sheep_id>', sheep_api.api_delete_sheep, name='api_delete_sheep'),
    path('api/sheep/breeder', sheep_api.api_get_breeder_sheep, name='api_get_breeder_sheep'),
    path('api/monitor/breeders', views.api_monitor_breeders, name='api_monitor_breeders'),
    path('api/monitor/devices', views.api_monitor_devices, name='api_monitor_devices'),
    path('api/monitor/devices/create', views.api_monitor_create, name='api_monitor_create'),
    path('api/monitor/devices/update/<int:device_id>', views.api_monitor_update, name='api_monitor_update'),
    path('api/monitor/devices/delete/<int:device_id>', views.api_monitor_delete, name='api_monitor_delete'),

    # 健康检查
    path('health', views.api_health, name='api_health'),

    # ==========================
    # 公开溯源页面（H5，无需登录，供扫码跳转）
    # ==========================
    path('trace/<int:sheep_id>/', views.sheep_trace_h5, name='sheep_trace_h5'),

    # 公开溯源数据 API（无需登录）
    path('api/public/trace/<int:sheep_id>', sheep_api.api_public_sheep_trace, name='api_public_sheep_trace'),

    # 传统视图路由
    path('sheep/', views.sheep_list, name='sheep_list'),
    path('sheep/<int:pk>/', views.sheep_detail, name='sheep_detail'),
    path('sheep/create/', views.sheep_create, name='sheep_create'),
    path('sheep/<int:pk>/edit/', views.sheep_edit, name='sheep_edit'),
    path('sheep/<int:pk>/delete/', views.sheep_delete, name='sheep_delete'),
    # 羊只记录管理路由
    path('sheep/<int:pk>/add-growth/', views.sheep_add_growth, name='sheep_add_growth'),
    path('sheep/<int:pk>/growth/<int:record_id>/delete/', views.sheep_delete_growth, name='sheep_delete_growth'),
    path('sheep/<int:pk>/add-feeding/', views.sheep_add_feeding, name='sheep_add_feeding'),
    path('sheep/<int:pk>/feeding/<int:record_id>/delete/', views.sheep_delete_feeding, name='sheep_delete_feeding'),
    path('sheep/<int:pk>/add-vaccination/', views.sheep_add_vaccination, name='sheep_add_vaccination'),
    path('sheep/<int:pk>/vaccination/<int:record_id>/delete/', views.sheep_delete_vaccination, name='sheep_delete_vaccination'),
    path('breeders/', views.breeder_list, name='breeder_list'),
    path('breeders/<int:pk>/', views.breeder_detail, name='breeder_detail'),
    path('breeders/create/', views.breeder_create, name='breeder_create'),
    path('breeders/<int:pk>/edit/', views.breeder_edit, name='breeder_edit'),
    path('breeders/<int:pk>/delete/', views.breeder_delete, name='breeder_delete'),
    path('growth/', views.growth_record_list, name='growth_record_list'),
    path('growth/create/', views.growth_record_create, name='growth_record_create'),
    path('feeding/', views.feeding_record_list, name='feeding_record_list'),
    path('feeding/create/', views.feeding_record_create, name='feeding_record_create'),
    path('vaccination/', views.vaccination_list, name='vaccination_list'),
    path('vaccination/create/', views.vaccination_create, name='vaccination_create'),
    path('users/', views.user_list, name='user_list'),
    path('users/batch-delete/', views.user_batch_delete, name='user_batch_delete'),
    path('users/<int:pk>/', views.user_detail, name='user_detail'),
    path('users/create/', views.user_create, name='user_create'),
    path('users/<int:pk>/edit/', views.user_update, name='user_update'),
    path('users/<int:pk>/delete/', views.user_delete, name='user_delete'),
    # 订单管理路由
    path('orders/', views.order_list, name='order_list'),
    path('orders/<int:pk>/', views.order_detail, name='order_detail'),
    path('orders/<int:pk>/update-status/', views.order_update_status, name='order_update_status'),
    
    # 养殖户个人中心路由
    path('breeder/dashboard/', views.breeder_dashboard, name='breeder_dashboard'),
    path('breeder/profile/', views.breeder_profile, name='breeder_profile'),
    path('breeder/location/update/', views.breeder_update_location, name='breeder_update_location'),
    
    # 环境预警路由
    path('alerts/<int:pk>/resolve/', views.resolve_alert, name='resolve_alert'),
    
    # 智慧牧场路由
    path('smart-farm/', views.smart_farm, name='smart_farm'),

    # 优惠券管理路由（Web端）
    path('coupons/', views.coupon_list, name='coupon_list'),
    path('coupons/create/', views.coupon_create, name='coupon_create'),
    path('coupons/<int:pk>/edit/', views.coupon_edit, name='coupon_edit'),
    path('coupons/<int:pk>/delete/', views.coupon_delete, name='coupon_delete'),
    path('coupons/<int:pk>/', views.coupon_detail, name='coupon_detail'),
    path('news/', views.news_list, name='news_list'),
    path('news/create/', views.news_create, name='news_create'),
    path('news/<int:pk>/edit/', views.news_edit, name='news_edit'),
    path('news/<int:pk>/delete/', views.news_delete, name='news_delete'),
    path('news/<int:pk>/publish/', views.news_publish, name='news_publish'),
    path('news/<int:pk>/set-top-slot/', views.news_set_top_slot, name='news_set_top_slot'),
    path('news/<int:pk>/', views.news_detail, name='news_detail'),
    
    # ==========================
    # 权限管理路由（仅管理员）
    # ==========================
    # 养殖户审核
    path('permissions/breeder-audit/', views.breeder_audit_list, name='breeder_audit_list'),
    path('permissions/breeder-audit/<int:pk>/', views.breeder_audit_detail, name='breeder_audit_detail'),
    path('permissions/breeder-audit/<int:pk>/approve/', views.breeder_approve, name='breeder_approve'),
    path('permissions/breeder-audit/<int:pk>/reject/', views.breeder_reject, name='breeder_reject'),
    
    # 用户角色管理
    path('permissions/roles/', views.role_user_list, name='role_user_list'),
    path('permissions/roles/<int:pk>/edit/', views.role_user_edit, name='role_user_edit'),
    
    # 权限概览
    path('permissions/overview/', views.permission_overview, name='permission_overview'),
    path('permissions/qa-stats/', views.qa_stats, name='qa_stats'),
    
    # ==========================
    # 优惠活动/优惠券接口
    # ==========================
    path('api/promotions/activities', views.api_promotion_activities, name='api_promotion_activities'),
    path('api/promotions/activities/<int:activity_id>', views.api_promotion_activity_detail, name='api_promotion_activity_detail'),
    path('api/promotions/coupons', views.api_coupons, name='api_coupons'),
    path('api/promotions/coupons/claim', views.api_claim_coupon, name='api_claim_coupon'),
    path('api/news/home', views.api_news_home, name='api_news_home'),
    path('api/news/list', views.api_news_list, name='api_news_list'),
    path('api/news/<int:news_id>', views.api_news_detail, name='api_news_detail'),

    # ==========================
    # 购物车接口（api/commerce_api.py）
    # ==========================
    path('api/cart', commerce_api.api_cart, name='api_cart'),
    path('api/cart/<int:item_id>', commerce_api.api_cart_item, name='api_cart_item'),
    path('api/cart/checkout', commerce_api.api_checkout, name='api_checkout'),
    path('api/my/sheep', commerce_api.api_my_sheep, name='api_my_sheep'),
    path('api/sheep/<int:sheep_id>/status', commerce_api.api_sheep_status, name='api_sheep_status'),
    path('api/orders', commerce_api.api_order_history, name='api_order_history'),
    path('api/breeder/orders', commerce_api.api_breeder_orders, name='api_breeder_orders'),
    path('api/breeder/orders/<int:order_id>/status', commerce_api.api_update_order_status, name='api_update_order_status')]


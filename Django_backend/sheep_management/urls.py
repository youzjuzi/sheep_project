from django.urls import path
from . import views  # ✅ 修正这里，直接导入 views

urlpatterns = [
    # ==========================
    # 核心修复区域：登录接口
    # ==========================

    # 1. 手机号一键登录
    path('api/auth/login_by_phone', views.api_login_by_phone, name='api_login_by_phone'),

    # 2. 微信静默登录 (修复 404 的关键)
    # 指向 api_login_wx 函数
    path('api/auth/login', views.api_login_wx, name='api_login_wx'),
    
    # 3. 用户名密码登录
    path('api/auth/login_password', views.api_login, name='api_login_password'),

    # Token 验证
    path('api/auth/check_token', views.api_check_token, name='api_check_token_new'),
    path('check_token', views.api_check_token, name='api_check_token'),

    # ==========================
    # 其他业务接口
    # ==========================
    path('', views.index, name='index'),

    # 羊只API
    path('api/sheep/search', views.api_search_sheep, name='api_search_sheep'),
    path('search_sheep', views.api_search_sheep, name='search_sheep_compat'),
    path('api/sheep/<int:sheep_id>', views.api_get_sheep_by_id, name='api_get_sheep_by_id'),
    path('search_sheep_by_id', views.api_get_sheep_by_id, name='search_sheep_by_id_compat'),

    # 疫苗记录API
    path('api/vaccine/records/<int:sheep_id>', views.api_get_vaccine_records, name='api_get_vaccine_records'),
    path('vaccine_records/<int:sheep_id>', views.api_get_vaccine_records, name='vaccine_records_compat'),

    # 养殖户API
    path('api/breeders', views.api_get_breeders, name='api_get_breeders'),
    path('api/breeders/<int:breeder_id>', views.api_get_breeders, name='api_get_breeder_detail'),
    path('breeders', views.api_get_breeders, name='breeders_compat'),
    path('breeders/<int:breeder_id>', views.api_get_breeders, name='breeders_detail_compat'),

    # 商品搜索
    path('search_goods', views.api_search_goods, name='api_search_goods'),

    # 生长记录
    path('api/growth/sheep/<int:sheep_id>', views.api_get_sheep_with_growth, name='api_get_sheep_with_growth'),

    # 智能问答
    path('api/qa/ask', views.api_qa_ask, name='api_qa_ask'),
]
"""
羊只相关 API 接口
薄接口层：解析 HTTP 参数 → 调用 Service → 构建 JsonResponse
"""
import json

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from ..services.sheep_service import SheepService, SheepError


def _error_response(e):
    """统一构建错误响应"""
    if isinstance(e, SheepError):
        return JsonResponse(
            {'code': e.code, 'msg': e.message, 'data': None},
            status=e.http_status
        )
    return JsonResponse(
        {'code': 500, 'msg': f'服务器错误: {str(e)}', 'data': None},
        status=500
    )


@csrf_exempt
@require_http_methods(["GET"])
def api_search_sheep(request):
    """
    搜索羊只接口
    GET /api/sheep/search
    """
    try:
        result = SheepService.search_sheep(
            gender=request.GET.get('gender', '').strip() or None,
            weight=request.GET.get('weight', '').strip() or None,
            height=request.GET.get('height', '').strip() or None,
            length=request.GET.get('length', '').strip() or None,
        )
        return JsonResponse(result, safe=False, status=200)
    except SheepError as e:
        return _error_response(e)
    except Exception as e:
        return _error_response(e)


@csrf_exempt
@require_http_methods(["GET"])
def api_get_sheep_by_id(request, sheep_id=None):
    """
    根据ID获取羊只详情
    GET /api/sheep/<sheep_id>
    """
    try:
        if not sheep_id:
            sheep_id = request.GET.get('id') or request.GET.get('pk')
        result = SheepService.get_sheep_by_id(sheep_id)
        return JsonResponse(result, status=200)
    except SheepError as e:
        return _error_response(e)
    except Exception as e:
        return _error_response(e)


@csrf_exempt
@require_http_methods(["GET"])
def api_get_vaccine_records(request, sheep_id):
    """
    获取羊只疫苗接种记录
    GET /api/vaccine/records/<sheep_id>
    """
    try:
        result = SheepService.get_vaccine_records(sheep_id)
        return JsonResponse(result, safe=False, status=200)
    except SheepError as e:
        return _error_response(e)
    except Exception as e:
        return _error_response(e)


@csrf_exempt
@require_http_methods(["GET"])
def api_get_sheep_with_growth(request, sheep_id):
    """
    获取羊只完整数据（含生长/喂养/疫苗记录）
    GET /api/growth/sheep/<sheep_id>
    """
    try:
        result = SheepService.get_sheep_with_growth(sheep_id)
        return JsonResponse(result, status=200)
    except SheepError as e:
        return _error_response(e)
    except Exception as e:
        return _error_response(e)


@csrf_exempt
@require_http_methods(["GET"])
def api_get_sheep_by_ear_tag(request):
    """
    根据耳标编号查询羊只信息（供扫码溯源使用）
    GET /api/sheep/trace?ear_tag=TY-2026-001
    """
    try:
        ear_tag = request.GET.get('ear_tag', '').strip()
        result = SheepService.get_sheep_by_ear_tag(
            ear_tag=ear_tag,
            build_absolute_uri=request.build_absolute_uri,
        )
        return JsonResponse(result, status=200)
    except SheepError as e:
        return _error_response(e)
    except Exception as e:
        return _error_response(e)


@csrf_exempt
@require_http_methods(["POST"])
def api_create_sheep(request):
    """
    创建羊只
    POST /api/sheep/create
    """
    from ..services.auth_service import AuthService
    try:
        # 验证用户身份
        token = request.POST.get('token') or request.META.get('HTTP_AUTHORIZATION', '').replace('Bearer ', '')
        if not token:
            return JsonResponse({'code': 401, 'msg': '缺少认证令牌', 'data': None}, status=401)
        
        user = AuthService.get_user_by_token(token)
        if user.role != 1:  # 只有养殖户可以创建羊只
            return JsonResponse({'code': 403, 'msg': '只有养殖户可以创建羊只', 'data': None}, status=403)
        
        # 解析数据
        data = {
            'ear_tag': request.POST.get('ear_tag'),
            'gender': request.POST.get('gender'),
            'weight': request.POST.get('weight'),
            'height': request.POST.get('height'),
            'length': request.POST.get('length'),
            'birth_date': request.POST.get('birth_date'),
            'farm_name': request.POST.get('farm_name'),
            'price': request.POST.get('price'),
        }
        
        # 处理文件上传
        image = request.FILES.get('image')
        video = request.FILES.get('video')
        
        result = SheepService.create_sheep(user, data, image, video)
        return JsonResponse({'code': 0, 'msg': '创建成功', 'data': result}, status=200)
    except SheepError as e:
        return _error_response(e)
    except Exception as e:
        return _error_response(e)


@csrf_exempt
@require_http_methods(["POST"])
def api_update_sheep(request, sheep_id):
    """
    更新羊只信息
    POST /api/sheep/update/<sheep_id>
    """
    from ..services.auth_service import AuthService
    try:
        # 验证用户身份
        token = request.POST.get('token') or request.META.get('HTTP_AUTHORIZATION', '').replace('Bearer ', '')
        if not token:
            return JsonResponse({'code': 401, 'msg': '缺少认证令牌', 'data': None}, status=401)
        
        user = AuthService.get_user_by_token(token)
        if user.role != 1:  # 只有养殖户可以更新羊只
            return JsonResponse({'code': 403, 'msg': '只有养殖户可以更新羊只', 'data': None}, status=403)
        
        # 解析数据
        data = {
            'ear_tag': request.POST.get('ear_tag'),
            'gender': request.POST.get('gender'),
            'weight': request.POST.get('weight'),
            'height': request.POST.get('height'),
            'length': request.POST.get('length'),
            'birth_date': request.POST.get('birth_date'),
            'farm_name': request.POST.get('farm_name'),
            'price': request.POST.get('price'),
        }
        
        # 处理文件上传
        image = request.FILES.get('image')
        video = request.FILES.get('video')
        
        result = SheepService.update_sheep(sheep_id, user, data, image, video)
        return JsonResponse({'code': 0, 'msg': '更新成功', 'data': result}, status=200)
    except SheepError as e:
        return _error_response(e)
    except Exception as e:
        return _error_response(e)


@csrf_exempt
@require_http_methods(["POST"])
def api_delete_sheep(request, sheep_id):
    """
    删除羊只
    POST /api/sheep/delete/<sheep_id>
    """
    from ..services.auth_service import AuthService
    try:
        # 验证用户身份
        token = request.POST.get('token') or request.META.get('HTTP_AUTHORIZATION', '').replace('Bearer ', '')
        if not token:
            return JsonResponse({'code': 401, 'msg': '缺少认证令牌', 'data': None}, status=401)
        
        user = AuthService.get_user_by_token(token)
        if user.role != 1:  # 只有养殖户可以删除羊只
            return JsonResponse({'code': 403, 'msg': '只有养殖户可以删除羊只', 'data': None}, status=403)
        
        result = SheepService.delete_sheep(sheep_id, user)
        return JsonResponse(result, status=200)
    except SheepError as e:
        return _error_response(e)
    except Exception as e:
        return _error_response(e)


@csrf_exempt
@require_http_methods(["GET"])
def api_get_breeder_sheep(request):
    """
    获取养殖户自己的羊只列表
    GET /api/sheep/breeder
    """
    from ..services.auth_service import AuthService
    try:
        # 验证用户身份
        token = request.GET.get('token') or request.META.get('HTTP_AUTHORIZATION', '').replace('Bearer ', '')
        if not token:
            return JsonResponse({'code': 401, 'msg': '缺少认证令牌', 'data': None}, status=401)
        
        user = AuthService.get_user_by_token(token)
        if user.role != 1:  # 只有养殖户可以获取自己的羊只列表
            return JsonResponse({'code': 403, 'msg': '只有养殖户可以获取自己的羊只列表', 'data': None}, status=403)
        
        result = SheepService.get_breeder_sheep_list(user)
        return JsonResponse({'code': 0, 'msg': '获取成功', 'data': result}, status=200)
    except SheepError as e:
        return _error_response(e)
    except Exception as e:
        return _error_response(e)


@csrf_exempt
@require_http_methods(["GET"])
def api_count_sheep(request):
    """
    获取符合条件的羊只数量（用于小程序筛选页动态显示）
    GET /api/sheep/count?gender=雄性&weights=20-30kg,30-40kg&heights=55-65cm&lengths=60-70cm
    """
    try:
        # 解析性别参数
        gender = request.GET.get('gender', '').strip() or None
        
        # 解析多选参数（逗号分隔）
        weights_str = request.GET.get('weights', '').strip()
        weights = weights_str.split(',') if weights_str else []
        
        heights_str = request.GET.get('heights', '').strip()
        heights = heights_str.split(',') if heights_str else []
        
        lengths_str = request.GET.get('lengths', '').strip()
        lengths = lengths_str.split(',') if lengths_str else []
        
        # 调用Service获取数量
        count = SheepService.count_sheep(
            gender=gender,
            weights=weights,
            heights=heights,
            lengths=lengths
        )
        
        return JsonResponse({
            'code': 0,
            'msg': 'success',
            'count': count
        }, status=200)
    except SheepError as e:
        return _error_response(e)
    except Exception as e:
        return _error_response(e)


@csrf_exempt
@require_http_methods(["GET"])
def api_search_sheep_multi(request):
    """
    多选筛选搜索羊只接口（支持体重、体高、体长多选）
    GET /api/sheep/search-multi?gender=雄性&weights=20-30kg,30-40kg&heights=55-65cm&lengths=60-70cm
    """
    try:
        # 解析性别参数
        gender = request.GET.get('gender', '').strip() or None
        
        # 解析多选参数（逗号分隔）
        weights_str = request.GET.get('weights', '').strip()
        weights = weights_str.split(',') if weights_str else []
        
        heights_str = request.GET.get('heights', '').strip()
        heights = heights_str.split(',') if heights_str else []
        
        lengths_str = request.GET.get('lengths', '').strip()
        lengths = lengths_str.split(',') if lengths_str else []
        
        # 调用Service搜索
        result = SheepService.search_sheep_multi(
            gender=gender,
            weights=weights,
            heights=heights,
            lengths=lengths
        )
        
        return JsonResponse(result, safe=False, status=200)
    except SheepError as e:
        return _error_response(e)
    except Exception as e:
        return _error_response(e)

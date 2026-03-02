"""
用户相关 API 接口
"""
import json

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from ..services.user_service import UserService, UserError


def _error_response(e):
    """统一构建错误响应"""
    if isinstance(e, UserError):
        return JsonResponse(
            {'code': e.code, 'msg': e.message, 'data': None},
            status=e.http_status
        )
    return JsonResponse(
        {'code': 500, 'msg': f'服务器错误: {str(e)}', 'data': None},
        status=500
    )


def _get_token(request):
    """从请求中提取 token（支持 header / query / body）"""
    auth = request.META.get('HTTP_AUTHORIZATION', '')
    if auth.startswith('Bearer '):
        return auth[7:]
    token = request.GET.get('token', '')
    if token:
        return token
    try:
        data = json.loads(request.body)
        return data.get('token', '')
    except (json.JSONDecodeError, Exception):
        return ''


@csrf_exempt
@require_http_methods(["GET"])
def api_user_info(request):
    """获取当前用户信息 GET /api/user/info?token=xxx"""
    try:
        token = _get_token(request)
        result = UserService.get_user_info(token)
        return JsonResponse({'code': 0, 'msg': 'ok', 'data': result})
    except UserError as e:
        return _error_response(e)
    except Exception as e:
        return _error_response(e)


@csrf_exempt
@require_http_methods(["GET"])
def api_get_profile(request):
    """获取用户详细资料 GET /api/user/profile?token=xxx"""
    try:
        token = _get_token(request)
        result = UserService.get_user_info(token)
        return JsonResponse({'code': 0, 'msg': 'ok', 'data': result})
    except UserError as e:
        return _error_response(e)
    except Exception as e:
        return _error_response(e)


@csrf_exempt
@require_http_methods(["POST"])
def api_get_avatar_upload_url(request):
    """
    获取头像上传的预签名 URL
    POST /api/user/avatar/upload-url
    请求体: { "token": "xxx", "file_ext": ".jpg", "content_type": "image/jpeg" }
    返回: { upload_url, object_key, public_url }
    """
    try:
        data = json.loads(request.body)
        token = data.get('token', '')
        result = UserService.generate_avatar_upload_url(
            token=token,
            file_ext=data.get('file_ext', '.jpg'),
            content_type=data.get('content_type', 'image/jpeg'),
        )
        return JsonResponse({'code': 0, 'msg': 'ok', 'data': result})
    except UserError as e:
        return _error_response(e)
    except Exception as e:
        return _error_response(e)


@csrf_exempt
@require_http_methods(["POST"])
def api_confirm_avatar(request):
    """
    确认头像上传完成
    POST /api/user/avatar/confirm
    请求体: { "token": "xxx", "object_key": "avatars/2/abc123.jpg" }
    返回: 更新后的用户信息
    """
    try:
        data = json.loads(request.body)
        token = data.get('token', '')
        result = UserService.confirm_avatar_upload(
            token=token,
            object_key=data.get('object_key', ''),
        )
        return JsonResponse({'code': 0, 'msg': '头像更新成功', 'data': result})
    except UserError as e:
        return _error_response(e)
    except Exception as e:
        return _error_response(e)


@csrf_exempt
@require_http_methods(["POST"])
def api_update_profile(request):
    """更新用户资料 POST /api/user/profile"""
    try:
        data = json.loads(request.body)
        token = data.get('token', '')
        result = UserService.update_profile(
            token=token,
            nickname=data.get('nickname'),
            description=data.get('description'),
            birthday=data.get('birthday'),
            gender=data.get('gender'),
            mobile=data.get('mobile'),
        )
        return JsonResponse({'code': 0, 'msg': '资料更新成功', 'data': result})
    except UserError as e:
        return _error_response(e)
    except Exception as e:
        return _error_response(e)


@csrf_exempt
@require_http_methods(["POST"])
def api_apply_breeder(request):
    """
    申请成为养殖户
    POST /api/user/apply_breeder
    请求体: { "token": "xxx", "mobile": "xxx" }
    返回: 更新后的用户信息
    """
    try:
        data = json.loads(request.body)
        token = data.get('token', '')
        mobile = data.get('mobile', '')
        result = UserService.apply_breeder(token=token, mobile=mobile)
        return JsonResponse({'code': 0, 'msg': '申请提交成功，请等待审核', 'data': result})
    except UserError as e:
        return _error_response(e)
    except Exception as e:
        return _error_response(e)


@csrf_exempt
@require_http_methods(["POST"])
def api_recharge(request):
    """
    余额充值
    POST /api/user/recharge
    请求体: { "token": "xxx", "amount": 100 }
    返回: { balance: 新余额, recharged: 本次充值金额 }
    """
    try:
        data = json.loads(request.body)
        token = data.get('token', '')
        amount = data.get('amount')
        if amount is None:
            return JsonResponse({'code': 400, 'msg': '缺少 amount 参数', 'data': None}, status=400)
        result = UserService.recharge(token=token, amount=amount)
        return JsonResponse({'code': 0, 'msg': '充值成功', 'data': result})
    except UserError as e:
        return _error_response(e)
    except Exception as e:
        return _error_response(e)

"""
商业模块 API 接口（购物车）
薄接口层：解析 HTTP 参数 → 调用 Service → 构建 JsonResponse
"""
import json

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from ..services.commerce_service import CommerceService, CommerceError


def _error_response(e):
    """统一构建错误响应"""
    if isinstance(e, CommerceError):
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
    # 1. 从 Authorization 头获取
    auth = request.META.get('HTTP_AUTHORIZATION', '')
    if auth.startswith('Bearer '):
        return auth[7:]
    # 2. 从 URL 参数获取
    token = request.GET.get('token', '')
    if token:
        return token
    # 3. 从请求体获取
    try:
        data = json.loads(request.body)
        return data.get('token', '')
    except (json.JSONDecodeError, Exception):
        return ''


@csrf_exempt
def api_cart(request):
    """
    购物车操作入口
    GET  /api/cart         → 获取购物车列表
    POST /api/cart         → 加入购物车（领养时调用）
    """
    if request.method == 'GET':
        return _get_cart(request)
    elif request.method == 'POST':
        return _add_to_cart(request)
    else:
        return JsonResponse({'code': 405, 'msg': '不支持的请求方法', 'data': None}, status=405)


@csrf_exempt
def api_cart_item(request, item_id):
    """
    单个购物车项操作
    PUT    /api/cart/<item_id>  → 更新数量
    DELETE /api/cart/<item_id>  → 移除
    """
    if request.method == 'PUT':
        return _update_cart_item(request, item_id)
    elif request.method == 'DELETE':
        return _delete_cart_item(request, item_id)
    else:
        return JsonResponse({'code': 405, 'msg': '不支持的请求方法', 'data': None}, status=405)


# ========================
#  具体处理函数
# ========================

def _get_cart(request):
    """获取购物车列表"""
    try:
        token = _get_token(request)
        result = CommerceService.get_cart(token)
        return JsonResponse({'code': 0, 'msg': 'ok', 'data': result})
    except CommerceError as e:
        return _error_response(e)
    except Exception as e:
        return _error_response(e)


def _add_to_cart(request):
    """加入购物车（领养时调用）"""
    try:
        data = json.loads(request.body)
        token = data.get('token', '') or _get_token(request)
        sheep_id = data.get('sheep_id')
        quantity = data.get('quantity', 1)
        price = data.get('price', 0)

        result = CommerceService.add_to_cart(
            token=token,
            sheep_id=sheep_id,
            quantity=quantity,
            price=price,
        )
        return JsonResponse({'code': 0, 'msg': '已加入购物车', 'data': result})
    except CommerceError as e:
        return _error_response(e)
    except Exception as e:
        return _error_response(e)


def _update_cart_item(request, item_id):
    """更新购物车商品数量"""
    try:
        data = json.loads(request.body)
        token = data.get('token', '') or _get_token(request)
        quantity = data.get('quantity', 1)

        result = CommerceService.update_cart_item(
            token=token,
            cart_item_id=item_id,
            quantity=quantity,
        )
        return JsonResponse({'code': 0, 'msg': '更新成功', 'data': result})
    except CommerceError as e:
        return _error_response(e)
    except Exception as e:
        return _error_response(e)


def _delete_cart_item(request, item_id):
    """从购物车移除"""
    try:
        token = _get_token(request)
        CommerceService.remove_from_cart(
            token=token,
            cart_item_id=item_id,
        )
        return JsonResponse({'code': 0, 'msg': '已移除', 'data': None})
    except CommerceError as e:
        return _error_response(e)
    except Exception as e:
        return _error_response(e)


@csrf_exempt
def api_checkout(request):
    """
    购物车结算
    POST /api/cart/checkout  → 将购物车商品打包为订单
    可选参数:
    { "token": "...", "payment_method": "balance" } (默认 "balance")
    """
    if request.method != 'POST':
        return JsonResponse({'code': 405, 'msg': '不支持的请求方法', 'data': None}, status=405)

    try:
        data = json.loads(request.body)
        token = data.get('token', '') or _get_token(request)
        payment_method = data.get('payment_method', 'balance')
        receiver_name    = (data.get('receiver_name', '') or '').strip() or None
        receiver_phone   = (data.get('receiver_phone', '') or '').strip() or None
        shipping_address = (data.get('shipping_address', '') or '').strip() or None
        user_coupon_id   = data.get('user_coupon_id')  # 新增
        
        result = CommerceService.checkout(
            token,
            payment_method=payment_method,
            receiver_name=receiver_name,
            receiver_phone=receiver_phone,
            shipping_address=shipping_address,
            user_coupon_id=user_coupon_id,  # 新增
        )
        return JsonResponse({'code': 0, 'msg': '结算成功', 'data': result})
    except CommerceError as e:
        return _error_response(e)
    except Exception as e:
        return _error_response(e)


@csrf_exempt
@require_http_methods(["GET"])
def api_my_sheep(request):
    """
    获取用户已购买的羊（结算后的）
    GET /api/my/sheep  → 返回已支付订单中的羊只列表
    """
    try:
        token = _get_token(request)
        result = CommerceService.get_my_sheep(token)
        return JsonResponse({'code': 0, 'msg': 'ok', 'data': result})
    except CommerceError as e:
        return _error_response(e)
    except Exception as e:
        return _error_response(e)


@csrf_exempt
@require_http_methods(["GET"])
def api_sheep_status(request, sheep_id):
    """
    查询羊只领养状态
    GET /api/sheep/<sheep_id>/status  → 返回该羊只的领养状态
    """
    try:
        token = _get_token(request)
        result = CommerceService.get_sheep_adopt_status(token, sheep_id)
        return JsonResponse({'code': 0, 'msg': 'ok', 'data': result})
    except CommerceError as e:
        return _error_response(e)
    except Exception as e:
        return _error_response(e)


@csrf_exempt
@require_http_methods(["GET"])
def api_order_history(request):
    """
    获取用户订单历史
    GET /api/orders  → 返回用户所有订单（已支付、已取消等）
    """
    try:
        token = _get_token(request)
        result = CommerceService.get_order_history(token)
        return JsonResponse({'code': 0, 'msg': 'ok', 'data': result})
    except CommerceError as e:
        return _error_response(e)
    except Exception as e:
        return _error_response(e)


@csrf_exempt
@require_http_methods(["GET"])
def api_breeder_orders(request):
    """
    获取养殖户的订单列表（用户发起的领养申请）
    GET /api/breeder/orders  → 返回养殖户羊只的订单列表
    """
    try:
        token = _get_token(request)
        result = CommerceService.get_breeder_orders(token)
        return JsonResponse({'code': 0, 'msg': 'ok', 'data': result})
    except CommerceError as e:
        return _error_response(e)
    except Exception as e:
        return _error_response(e)


@csrf_exempt
@require_http_methods(["PUT"])
def api_update_order_status(request, order_id):
    """
    更新订单状态（确认或拒绝领养请求，更新发货状态等）
    PUT /api/breeder/orders/<order_id>/status  → 更新订单状态
    请求体: { 
        "token": "...", 
        "status": "paid|shipping|completed|cancelled",
        "logistics_info": {"logistics_company": "...", "logistics_tracking_number": "..."}  # 发货时需要
    }
    """
    if request.method != 'PUT':
        return JsonResponse({'code': 405, 'msg': '不支持的请求方法', 'data': None}, status=405)

    try:
        data = json.loads(request.body)
        token = data.get('token', '') or _get_token(request)
        status = data.get('status')
        logistics_info = data.get('logistics_info')
        
        result = CommerceService.update_order_status(token, order_id, status, logistics_info)
        return JsonResponse({'code': 0, 'msg': '订单状态更新成功', 'data': result})
    except CommerceError as e:
        return _error_response(e)
    except Exception as e:
        return _error_response(e)

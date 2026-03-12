from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
import json

from ..models import User, BreederFollow, Sheep
from ..utils import verify_token


def _resolve_user_from_token(request, data=None):
    token = ''
    if data:
        token = (data.get('token') or '').strip()
    if not token:
        token = (request.GET.get('token') or '').strip()
    if not token:
        auth = request.META.get('HTTP_AUTHORIZATION', '') or ''
        if auth.lower().startswith('bearer '):
            token = auth[7:].strip()

    if not token:
        return None

    payload = verify_token(token)
    if not payload:
        return None

    user_id = payload.get('user_id')
    if not user_id:
        return None

    try:
        return User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return None


def _parse_follow_flag(value, default=True):
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    text = str(value).strip().lower()
    if text in ('0', 'false', 'no', 'off'):
        return False
    if text in ('1', 'true', 'yes', 'on'):
        return True
    return default


def _set_follow_state(user, breeder_id, follow):
    try:
        breeder_id = int(breeder_id)
    except (TypeError, ValueError):
        return JsonResponse({'code': 400, 'msg': 'breeder_id格式错误', 'data': None}, status=400)

    try:
        breeder = User.objects.get(pk=breeder_id, role=1)
    except User.DoesNotExist:
        return JsonResponse({'code': 404, 'msg': '养殖户不存在', 'data': None}, status=404)

    if breeder.id == user.id:
        return JsonResponse({'code': 400, 'msg': '不能关注自己', 'data': None}, status=400)

    if follow:
        _, created = BreederFollow.objects.get_or_create(user=user, breeder=breeder)
        followers_count = BreederFollow.objects.filter(breeder=breeder).count()
        return JsonResponse({
            'code': 0,
            'msg': '关注成功' if created else '已关注',
            'data': {
                'is_followed': True,
                'followers_count': followers_count
            }
        }, status=200)

    BreederFollow.objects.filter(user=user, breeder=breeder).delete()
    followers_count = BreederFollow.objects.filter(breeder=breeder).count()
    return JsonResponse({
        'code': 0,
        'msg': '已取消关注',
        'data': {
            'is_followed': False,
            'followers_count': followers_count
        }
    }, status=200)


@csrf_exempt
@require_http_methods(["POST"])
def api_breeder_follow(request):
    """关注/取消关注养殖户
    POST /api/breeders/follow
    body: { token, breeder_id, follow }  # follow=true关注, false取消
    """
    try:
        data = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return JsonResponse({'code': 400, 'msg': '请求数据格式错误', 'data': None}, status=400)

    user = _resolve_user_from_token(request, data)
    if not user:
        return JsonResponse({'code': 401, 'msg': '用户未登录或登录已过期', 'data': None}, status=401)

    breeder_id = data.get('breeder_id') or data.get('breederId')
    if not breeder_id:
        return JsonResponse({'code': 400, 'msg': 'breeder_id不能为空', 'data': None}, status=400)

    follow = _parse_follow_flag(data.get('follow'), True)
    return _set_follow_state(user, breeder_id, follow)


@csrf_exempt
@require_http_methods(["POST"])
def api_breeder_unfollow(request):
    """取消关注养殖户
    POST /api/breeders/unfollow
    body: { token, breeder_id }
    """
    try:
        data = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return JsonResponse({'code': 400, 'msg': '请求数据格式错误', 'data': None}, status=400)

    user = _resolve_user_from_token(request, data)
    if not user:
        return JsonResponse({'code': 401, 'msg': '用户未登录或登录已过期', 'data': None}, status=401)

    breeder_id = data.get('breeder_id') or data.get('breederId')
    if not breeder_id:
        return JsonResponse({'code': 400, 'msg': 'breeder_id不能为空', 'data': None}, status=400)

    return _set_follow_state(user, breeder_id, False)


@csrf_exempt
@require_http_methods(["GET"])
def api_breeder_follows(request):
    """我的关注列表
    GET /api/breeders/follows?token=xxx
    """
    user = _resolve_user_from_token(request)
    if not user:
        return JsonResponse({'code': 401, 'msg': '用户未登录或登录已过期', 'data': None}, status=401)

    follows = BreederFollow.objects.filter(user=user).select_related('breeder').order_by('-created_at')
    breeder_ids = [f.breeder_id for f in follows]

    sheep_count_map = {}
    if breeder_ids:
        from django.db.models import Count
        sheep_count_map = dict(
            Sheep.objects.filter(owner_id__in=breeder_ids)
            .values('owner_id')
            .annotate(cnt=Count('id'))
            .values_list('owner_id', 'cnt')
        )

    result = []
    for f in follows:
        breeder = f.breeder
        avatar_url = breeder.avatar_url or ''
        if avatar_url and not (avatar_url.startswith('http://') or avatar_url.startswith('https://')):
            avatar_url = request.build_absolute_uri(avatar_url)
        result.append({
            'id': breeder.id,
            'name': breeder.nickname or breeder.username,
            'avatar_url': avatar_url,
            'sheep_count': sheep_count_map.get(breeder.id, 0),
            'followed_at': f.created_at.strftime('%Y-%m-%d %H:%M:%S')
        })

    return JsonResponse({'code': 0, 'msg': '获取成功', 'data': result}, status=200)

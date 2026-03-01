"""API接口视图"""
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.db.models import Q
import json
import re
from datetime import datetime, date
from django.utils import timezone
from ..models import User, Sheep, VaccinationHistory, GrowthRecord, FeedingRecord, CartItem, PromotionActivity, Coupon
from ..utils import generate_token, verify_token
import requests

@require_http_methods(["GET"])
def api_health(request):
    """健康检查：返回后端运行状态"""
    return JsonResponse({'status': 'ok', 'time': datetime.now().strftime('%Y-%m-%d %H:%M:%S')})
@csrf_exempt
@require_http_methods(["POST"])
def api_register(request):
    """
    用户注册接口
    POST /api/auth/register
    请求体：
        {
            "username": "用户名",
            "password": "密码",
            "mobile": "手机号（可选）",
            "nickname": "昵称（可选）"
        }
    """
    try:
        data = json.loads(request.body)
        username = data.get('username', '').strip()
        password = data.get('password', '').strip()
        mobile = data.get('mobile', '').strip()
        nickname = data.get('nickname', '').strip()

        # 验证必填项
        if not username:
            return JsonResponse({'code': 400, 'msg': '用户名不能为空', 'data': None}, status=400)
        
        if not password:
            return JsonResponse({'code': 400, 'msg': '密码不能为空', 'data': None}, status=400)

        # 验证用户名长度
        if len(username) < 3 or len(username) > 50:
            return JsonResponse({'code': 400, 'msg': '用户名长度为3-50个字符', 'data': None}, status=400)

        # 验证密码长度
        if len(password) < 6:
            return JsonResponse({'code': 400, 'msg': '密码长度至少6个字符', 'data': None}, status=400)

        # 检查用户名是否已存在（通过用户名或手机号）
        if User.objects.filter(username=username).exists():
            return JsonResponse({'code': 409, 'msg': '用户名已存在', 'data': None}, status=409)
        
        # 如果提供了手机号，检查手机号是否已注册
        if mobile and User.objects.filter(mobile=mobile).exists():
            return JsonResponse({'code': 409, 'msg': '手机号已被注册', 'data': None}, status=409)

        # 生成一个临时的 openid（因为没有微信登录）
        # 使用时间戳+用户名哈希作为唯一标识
        import hashlib
        import time
        temp_openid = hashlib.md5(f"{username}_{time.time()}".encode()).hexdigest()

        # 创建新用户
        user = User.objects.create(
            username=username,
            password=password,  # 注意：实际生产环境应该加密存储密码
            mobile=mobile or None,
            nickname=nickname or username,
            openid=temp_openid,  # 临时openid
            created_at=datetime.now()
        )

        # 生成 token
        token = generate_token(user.id, user.username)

        return JsonResponse({
            'code': 0,
            'msg': '注册成功',
            'data': {
                'token': token,
                'uid': user.id,
                'username': user.username,
                'nickname': user.nickname or '',
                'mobile': user.mobile or '',
                'userInfo': {
                    'id': user.id,
                    'username': user.username,
                    'nickname': user.nickname or '',
                    'mobile': user.mobile or ''
                }
            }
        }, status=200)

    except json.JSONDecodeError:
        return JsonResponse({'code': 400, 'msg': '请求数据格式错误', 'data': None}, status=400)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({'code': 500, 'msg': f'服务器错误: {str(e)}', 'data': None}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def api_login(request):
    """
    账号密码登录接口
    POST /api/auth/login
    """
    try:
        data = json.loads(request.body)
        username = data.get('username', 'wx584a350ed4b974a0').strip()
        password = data.get('password', '11f0f8f7eed7e4cdc39ca4333bfd2134').strip()

        if not username or not password:
            return JsonResponse({'code': 400, 'msg': '用户名和密码不能为空', 'data': None}, status=400)

        # 支持通过用户名或手机号登录
        user = User.objects.filter(
            Q(username=username) | Q(mobile=username)
        ).first()
        
        if not user:
            return JsonResponse({'code': 401, 'msg': '用户名或密码错误', 'data': None}, status=401)
        
        # 检查密码
        # 如果用户没有设置密码，不允许登录
        if not user.password:
            return JsonResponse({'code': 401, 'msg': '该账号未设置密码，请使用微信登录', 'data': None}, status=401)
        
        # 验证密码
        if user.password != password:
            return JsonResponse({'code': 401, 'msg': '用户名或密码错误', 'data': None}, status=401)

        user.last_login = datetime.now()
        user.save()

        token = generate_token(user.id, user.username)

        return JsonResponse({
            'code': 0,
            'msg': '登录成功',
            'data': {
                'token': token,
                'uid': user.id,
                'username': user.username,
                'nickname': user.nickname or '',
                'openid': user.openid or '',
                'mobile': user.mobile or ''
            }
        }, status=200)

    except json.JSONDecodeError:
        return JsonResponse({'code': 400, 'msg': '请求数据格式错误', 'data': None}, status=400)
    except Exception as e:
        return JsonResponse({'code': 500, 'msg': f'服务器错误: {str(e)}', 'data': None}, status=500)


@csrf_exempt
@require_http_methods(["GET"])
def api_search_sheep(request):
    """
    搜索羊只接口
    """
    try:
        gender = request.GET.get('gender', '').strip()
        weight = request.GET.get('weight', '').strip()
        height = request.GET.get('height', '').strip()
        length = request.GET.get('length', '').strip()

        query = Q()

        if gender:
            # 支持数字和中文关键词
            if gender in ['公', 'male', '1', 1]:
                query &= Q(gender=1)
            elif gender in ['母', 'female', '0', 0]:
                query &= Q(gender=0)
            else:
                # 尝试转换为整数
                try:
                    gender_int = int(gender)
                    if gender_int in [0, 1]:
                        query &= Q(gender=gender_int)
                except (ValueError, TypeError):
                    pass

        if weight:
            weight_range = parse_range(weight)
            if weight_range:
                query &= Q(weight__gte=weight_range[0], weight__lte=weight_range[1])

        if height:
            height_range = parse_range(height)
            if height_range:
                query &= Q(height__gte=height_range[0], height__lte=height_range[1])

        if length:
            length_range = parse_range(length)
            if length_range:
                query &= Q(length__gte=length_range[0], length__lte=length_range[1])

        sheep_list = Sheep.objects.filter(query)

        result = []
        for sheep in sheep_list:
            result.append({
                'id': sheep.id,
                'gender': sheep.get_gender_display(),  # 显示为中文
                'weight': float(sheep.weight),
                'height': float(sheep.height),
                'length': float(sheep.length)
            })

        return JsonResponse(result, safe=False, status=200)

    except Exception as e:
        return JsonResponse({'code': 500, 'msg': f'服务器错误: {str(e)}', 'data': None}, status=500)


@csrf_exempt
@require_http_methods(["GET"])
def api_get_sheep_by_id(request, sheep_id=None):
    """
    根据ID获取羊只详情
    """
    try:
        if not sheep_id:
            sheep_id = request.GET.get('id') or request.GET.get('pk')

        if not sheep_id:
            return JsonResponse({'code': 400, 'msg': '缺少羊只ID参数', 'data': None}, status=400)

        try:
            sheep = Sheep.objects.get(pk=sheep_id)
            result = {
                'id': sheep.id,
                'gender': sheep.get_gender_display(),  # 显示为中文
                'weight': float(sheep.weight),
                'height': float(sheep.height),
                'length': float(sheep.length)
            }
            return JsonResponse(result, status=200)
        except Sheep.DoesNotExist:
            return JsonResponse({'code': 404, 'msg': '羊只不存在', 'data': None}, status=404)

    except Exception as e:
        return JsonResponse({'code': 500, 'msg': f'服务器错误: {str(e)}', 'data': None}, status=500)


@csrf_exempt
@require_http_methods(["GET"])
def api_get_vaccine_records(request, sheep_id):
    """
    获取羊只疫苗接种记录
    """
    try:
        records = VaccinationHistory.objects.filter(sheep_id=sheep_id).order_by('-vaccination_date')

        result = []
        for record in records:
            result.append({
                'VaccinationID': record.vaccine_id,
                'VaccineType': record.vaccine.name,
                'VaccinationDate': record.vaccination_date.strftime('%Y-%m-%d'),
                'ExpiryDate': record.expiry_date.strftime('%Y-%m-%d'),
                'Dosage': float(record.dosage),
                'AdministeredBy': record.administered_by,
                'Notes': record.notes or ''
            })

        return JsonResponse(result, safe=False, status=200)

    except Exception as e:
        return JsonResponse({'code': 500, 'msg': f'服务器错误: {str(e)}', 'data': None}, status=500)


def parse_range(range_str):
    """解析范围字符串"""
    if not range_str:
        return None
    range_str = re.sub(r'\s*(kg|cm|g|m)\s*', '', range_str, flags=re.IGNORECASE)
    match = re.match(r'(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)', range_str)
    if match:
        try:
            return (float(match.group(1)), float(match.group(2)))
        except ValueError:
            pass
    return None


@csrf_exempt
@require_http_methods(["GET"])
def api_get_breeders(request, breeder_id=None):
    """
    获取养殖户列表或详情
    """
    try:
        if breeder_id:
            # ----------------- 获取单个养殖户详情 -----------------
            try:
                # 直接查询，不再尝试访问 latitude 等不存在的字段
                breeder = User.objects.get(pk=breeder_id, role=1)

                # 获取关联的羊只列表
                sheep_list = Sheep.objects.filter(owner=breeder)
                actual_sheep_count = sheep_list.count()

                # 统计羊只性别分布
                actual_female_count = sheep_list.filter(gender=0).count()
                actual_male_count = sheep_list.filter(gender=1).count()

                # 获取羊只详细信息
                sheep_data = []
                today = date.today()

                for sheep in sheep_list:
                    # 检查疫苗接种情况
                    vaccine_records = VaccinationHistory.objects.filter(sheep=sheep)
                    vaccine_count = vaccine_records.count()
                    try:
                        has_recent_vaccine = vaccine_records.filter(expiry_date__gte=today).exists()
                    except Exception:
                        has_recent_vaccine = vaccine_count > 0

                    sheep_data.append({
                        'id': sheep.id,
                        'gender': sheep.get_gender_display(),  # 显示为中文
                        'weight': float(sheep.weight),
                        'height': float(sheep.height),
                        'length': float(sheep.length),
                        'vaccine_count': vaccine_count,
                        'is_healthy': has_recent_vaccine,
                        'image_url': f'/images/sheep/{sheep.id}.jpg'
                    })

                # 统计健康状态
                healthy_count = sum(1 for s in sheep_data if s['is_healthy'])
                health_rate = (healthy_count / actual_sheep_count * 100) if actual_sheep_count > 0 else 0
                avg_weight = sum(s['weight'] for s in sheep_data) / actual_sheep_count if actual_sheep_count > 0 else 0

                avatar_url = breeder.avatar_url or ''
                if avatar_url and not (avatar_url.startswith('http://') or avatar_url.startswith('https://')):
                    avatar_url = request.build_absolute_uri(avatar_url)

                result = {
                    'id': breeder.id,
                    'name': breeder.nickname or breeder.username,
                    'gender': breeder.get_gender_display() if breeder.gender is not None else '',
                    'phone': breeder.mobile or '',
                    'avatar_url': avatar_url,
                    'sheep_count': actual_sheep_count,
                    'actual_sheep_count': actual_sheep_count,
                    'sheep_id': str(breeder.id),
                    'female_count': actual_female_count,
                    'male_count': actual_male_count,
                    'actual_female_count': actual_female_count,
                    'actual_male_count': actual_male_count,
                    'icon_url': f'/images/farmer/people/p{breeder.id % 10 + 1}.png',
                    'isFollowed': False,
                    # 数据库无位置信息，统一返回 None
                    'latitude': None,
                    'longitude': None,
                    'address': None,
                    'sheep_list': sheep_data,
                    'statistics': {
                        'total_sheep': actual_sheep_count,
                        'healthy_count': healthy_count,
                        'health_rate': round(health_rate, 1),
                        'avg_weight': round(avg_weight, 2),
                        'vaccine_coverage': round((healthy_count / actual_sheep_count * 100) if actual_sheep_count > 0 else 0, 1)
                    },
                    'rating': 4.5,
                    'followers_count': 0,
                    'description': f'专业养殖户，拥有{actual_sheep_count}只优质滩羊，养殖经验丰富。'
                }
                return JsonResponse(result, status=200)
            except User.DoesNotExist:
                return JsonResponse({'code': 404, 'msg': '养殖户不存在', 'data': None}, status=404)
        else:
            # ----------------- 获取养殖户列表 -----------------
            try:
                # 简单直接查询所有，不加 defer
                breeders = User.objects.filter(role=1)
                breeder_count = breeders.count()
                print(f'[API] 成功查询到 {breeder_count} 个养殖户')

                result = []
                today = date.today()

                for breeder in breeders:
                    try:
                        actual_sheep_count = Sheep.objects.filter(owner=breeder).count()

                        avatar_url = breeder.avatar_url or ''
                        if avatar_url and not (avatar_url.startswith('http://') or avatar_url.startswith('https://')):
                            avatar_url = request.build_absolute_uri(avatar_url)

                        # 统计健康羊只
                        try:
                            healthy_count = Sheep.objects.filter(
                                owner=breeder,
                                vaccination_records__expiry_date__gte=today
                            ).distinct().count()
                        except Exception:
                            healthy_count = 0

                        result.append({
                            'id': breeder.id,
                            'name': breeder.nickname or breeder.username,
                            'gender': breeder.get_gender_display() if breeder.gender is not None else '',
                            'phone': breeder.mobile or '',
                            'avatar_url': avatar_url,
                            'sheep_count': Sheep.objects.filter(owner=breeder).count(),
                            'actual_sheep_count': actual_sheep_count,
                            'sheep_id': str(breeder.id),
                            'female_count': Sheep.objects.filter(owner=breeder, gender=0).count(),
                            'male_count': Sheep.objects.filter(owner=breeder, gender=1).count(),
                            'icon_url': f'/images/farmer/people/p{breeder.id % 10 + 1}.png',
                            'healthy_count': healthy_count,
                            'rating': 4.5,
                            'followers_count': 0,
                            # 数据库无位置信息，统一返回 None
                            'latitude': None,
                            'longitude': None,
                            'address': None
                        })
                    except Exception as e:
                        print(f'[API] 处理养殖户出错 (breeder_id={breeder.id}): {e}')
                        continue

                return JsonResponse(result, safe=False, status=200)
            except Exception as e:
                import traceback
                print(f'[API错误] 获取养殖户列表失败: {str(e)}')
                traceback.print_exc()
                return JsonResponse({'code': 500, 'msg': f'服务器错误: {str(e)}', 'data': None}, status=500)

    except Exception as e:
        import traceback
        print(f'[API错误] api_get_breeders: {str(e)}')
        traceback.print_exc()
        return JsonResponse({'code': 500, 'msg': f'服务器错误: {str(e)}', 'data': None}, status=500)


@csrf_exempt
@require_http_methods(["GET"])
def api_search_goods(request):
    """
    全站搜索接口 - 搜索数据库中的所有数据
    包括：羊只、养殖户、优惠活动、优惠券等
    """
    try:
        keyword = request.GET.get('keyword', '').strip()

        if not keyword:
            return JsonResponse([], safe=False, status=200)

        result = []
        
        # 1. 搜索羊只
        try:
            # 构建搜索条件
            sheep_q = Q()
            
            # 尝试将关键词转换为数字（可能是羊只ID或体重值）
            try:
                num_value = float(keyword)
                # 如果是整数，可能是ID
                if num_value.is_integer():
                    sheep_id = int(num_value)
                    sheep_list = Sheep.objects.filter(id=sheep_id)
                else:
                    # 浮点数，可能是体重/身高/体长（允许±5的误差）
                    sheep_list = Sheep.objects.filter(
                        Q(weight__gte=num_value-5, weight__lte=num_value+5) |
                        Q(height__gte=num_value-5, height__lte=num_value+5) |
                        Q(length__gte=num_value-5, length__lte=num_value+5)
                    )[:10]
            except ValueError:
                # 文本搜索：性别字段（支持中文关键词）
                gender_map = {
                    '公': 1, 'male': 1, '1': 1,
                    '母': 0, 'female': 0, '0': 0
                }
                gender_value = gender_map.get(keyword.lower(), gender_map.get(keyword))
                if gender_value is not None:
                    sheep_list = Sheep.objects.filter(gender=gender_value)[:10]
                else:
                    sheep_list = Sheep.objects.none()
            
            # 计算价格：根据体重计算（单价约 8-10元/kg）
            PRICE_PER_KG = 8.5  # 每公斤价格
            
            for sheep in sheep_list:
                # 根据体重计算价格
                calculated_price = round(float(sheep.weight) * PRICE_PER_KG, 2)
                
                result.append({
                    'type': 'sheep',
                    'id': sheep.id,
                    'name': f'羊只#{sheep.id}',
                    'title': f'羊只#{sheep.id} - {sheep.get_gender_display()}',
                    'description': f'性别: {sheep.get_gender_display()}, 体重: {sheep.weight}kg, 身高: {sheep.height}cm, 体长: {sheep.length}cm',
                    'price': calculated_price,
                    'image': '/images/icons/function/f1.png',
                    'gender': sheep.get_gender_display(),  # 显示为中文
                    'weight': float(sheep.weight),
                    'height': float(sheep.height),
                    'length': float(sheep.length),
                    'breeder_id': sheep.owner_id if sheep.owner_id else None,
                    'breeder_name': sheep.owner.nickname or sheep.owner.username if sheep.owner else None
                })
        except Exception as e:
            print(f'搜索羊只时出错: {str(e)}')
        
        # 2. 搜索养殖户
        try:
            breeders = User.objects.filter(
                role=1
            ).filter(
                Q(nickname__icontains=keyword) |
                Q(mobile__icontains=keyword) |
                Q(username__icontains=keyword)
            )[:10]
            
            for breeder in breeders:
                result.append({
                    'type': 'breeder',
                    'id': breeder.id,
                    'name': breeder.nickname or breeder.username,
                    'title': f'养殖户: {breeder.nickname or breeder.username}',
                    'description': f'联系电话: {breeder.mobile or ""}, 羊只总数: {Sheep.objects.filter(owner=breeder).count()}只',
                    'price': 0,
                    'image': '/images/icons/function/f8.png',
                    'phone': breeder.mobile or '',
                    'sheep_count': Sheep.objects.filter(owner=breeder).count(),
                    'gender': breeder.get_gender_display() if breeder.gender is not None else ''
                })
        except Exception as e:
            print(f'搜索养殖户时出错: {str(e)}')
        
        # 3. 搜索优惠活动
        try:
            activities = PromotionActivity.objects.filter(
                Q(title__icontains=keyword) |
                Q(description__icontains=keyword)
            ).filter(status='active')[:10]
            
            for activity in activities:
                result.append({
                    'type': 'activity',
                    'id': activity.id,
                    'name': activity.title,
                    'title': activity.title,
                    'description': activity.description or '',
                    'price': 0,
                    'image': activity.image_url or '/images/icons/function/f4.png',
                    'activity_type': activity.activity_type,
                    'discount_rate': float(activity.discount_rate) if activity.discount_rate else None,
                    'discount_amount': float(activity.discount_amount) if activity.discount_amount else None
                })
        except Exception as e:
            print(f'搜索优惠活动时出错: {str(e)}')
        
        # 4. 搜索优惠券
        try:
            now = timezone.now()
            coupons = Coupon.objects.filter(
                Q(name__icontains=keyword) |
                Q(code__icontains=keyword) |
                Q(description__icontains=keyword)
            ).filter(
                status='active',
                valid_from__lte=now,
                valid_until__gte=now
            )[:10]
            
            for coupon in coupons:
                result.append({
                    'type': 'coupon',
                    'id': coupon.id,
                    'name': coupon.name,
                    'title': coupon.name,
                    'description': coupon.description or f'优惠码: {coupon.code}',
                    'price': 0,
                    'image': '/images/icons/function/f4.png',
                    'code': coupon.code,
                    'coupon_type': coupon.coupon_type,
                    'discount_amount': float(coupon.discount_amount) if coupon.discount_amount else None,
                    'discount_rate': float(coupon.discount_rate) if coupon.discount_rate else None
                })
        except Exception as e:
            print(f'搜索优惠券时出错: {str(e)}')
        
        # 限制返回结果数量
        result = result[:50]
        
        return JsonResponse(result, safe=False, status=200)

    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({'code': 500, 'msg': f'服务器错误: {str(e)}', 'data': None}, status=500)


@csrf_exempt
@require_http_methods(["GET"])
def api_get_sheep_with_growth(request, sheep_id):
    """
    获取羊只完整数据
    """
    try:
        try:
            sheep_id = int(sheep_id)
        except (ValueError, TypeError):
            return JsonResponse({'code': 400, 'msg': '无效的羊只ID', 'data': None}, status=400)

        try:
            sheep = Sheep.objects.get(pk=sheep_id)
        except Sheep.DoesNotExist:
            return JsonResponse({'code': 404, 'msg': '羊只不存在', 'data': None}, status=404)

        # 获取生长记录
        growth_data = []
        try:
            growth_records = GrowthRecord.objects.filter(sheep=sheep).order_by('record_date')
            for record in growth_records:
                growth_data.append({
                    'id': record.id,
                    'record_date': record.record_date.strftime('%Y-%m-%d') if record.record_date else '',
                    'weight': float(record.weight) if record.weight is not None else 0.0,
                    'height': float(record.height) if record.height is not None else 0.0,
                    'length': float(record.length) if record.length is not None else 0.0
                })
        except Exception:
            pass

        # 获取喂养记录
        feeding_data = []
        try:
            feeding_records = FeedingRecord.objects.filter(sheep=sheep).order_by('-start_date')
            for record in feeding_records:
                feeding_data.append({
                    'id': record.id,
                    'feed_type': record.feed_type or '',
                    'start_date': record.start_date.strftime('%Y-%m-%d') if record.start_date else '',
                    'end_date': record.end_date.strftime('%Y-%m-%d') if record.end_date else None,
                    'amount': float(record.amount) if record.amount is not None else 0.0,
                    'unit': record.unit or ''
                })
        except Exception:
            pass

        # 获取疫苗接种记录
        vaccination_data = []
        try:
            vaccination_records = VaccinationHistory.objects.filter(sheep=sheep).order_by('-vaccination_date')
            for record in vaccination_records:
                vaccination_data.append({
                    'id': record.id,
                    'vaccination_id': record.vaccine_id,
                    'vaccine_type': record.vaccine.name,
                    'vaccination_date': record.vaccination_date.strftime('%Y-%m-%d') if record.vaccination_date else '',
                    'expiry_date': record.expiry_date.strftime('%Y-%m-%d') if record.expiry_date else '',
                    'dosage': float(record.dosage) if record.dosage is not None else 0.0,
                    'administered_by': record.administered_by or '',
                    'notes': record.notes or ''
                })
        except Exception:
            pass

        result = {
            'id': sheep.id,
            'gender': sheep.get_gender_display() if sheep.gender is not None else '',  # 显示为中文
            'weight': float(sheep.weight) if sheep.weight is not None else 0.0,
            'height': float(sheep.height) if sheep.height is not None else 0.0,
            'length': float(sheep.length) if sheep.length is not None else 0.0,
            'growth_records': growth_data,
            'feeding_records': feeding_data,
            'vaccination_records': vaccination_data
        }

        return JsonResponse(result, status=200)

    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({'code': 500, 'msg': f'服务器错误: {str(e)}', 'data': None}, status=500)


@csrf_exempt
@require_http_methods(["POST", "GET"])
def api_check_token(request):
    """
    验证token接口
    """
    try:
        if request.method == 'POST':
            data = json.loads(request.body)
            token = data.get('token', '').strip()
        else:
            token = request.GET.get('token', '').strip()

        if not token:
            return JsonResponse({'code': 400, 'msg': '缺少token参数', 'data': None}, status=400)

        payload = verify_token(token)

        if not payload:
            return JsonResponse({'code': 401, 'msg': 'token无效或已过期', 'data': None}, status=401)

        user_id = payload.get('user_id')
        try:
            user = User.objects.get(pk=user_id)
            return JsonResponse({
                'code': 0,
                'msg': 'token有效',
                'data': {
                    'uid': user.id,
                    'username': user.username or '',
                    'nickname': user.nickname or '',
                    'openid': user.openid or '',
                    'mobile': user.mobile or ''
                }
            }, status=200)
        except User.DoesNotExist:
            return JsonResponse({'code': 404, 'msg': '用户不存在', 'data': None}, status=404)

    except json.JSONDecodeError:
        return JsonResponse({'code': 400, 'msg': '请求数据格式错误', 'data': None}, status=400)
    except Exception as e:
        return JsonResponse({'code': 500, 'msg': f'服务器错误: {str(e)}', 'data': None}, status=500)

@csrf_exempt
@require_http_methods(["POST"])
def api_login_by_phone(request):
    # 👇👇👇 这里的 AppID 和 Secret 必须填你自己的！👇👇👇
    APP_ID = 'wx584a350ed4b974a0'
    APP_SECRET = '11f0f8f7eed7e4cdc39ca4333bfd2134'

    try:
        data = json.loads(request.body)
        code = data.get('code')
        phone_code = data.get('phoneCode')

        if not code or not phone_code:
            return JsonResponse({'code': 400, 'msg': '参数缺失'})

        # 1. 获取 Access Token
        token_url = f"https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid={APP_ID}&secret={APP_SECRET}"
        token_res = requests.get(token_url).json()
        access_token = token_res.get('access_token')
        if not access_token:
            return JsonResponse({'code': 500, 'msg': '后端配置错误: AccessToken获取失败'})

        # 2. 解析手机号
        phone_url = f"https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token={access_token}"
        phone_res = requests.post(phone_url, json={"code": phone_code}).json()
        if phone_res.get('errcode') != 0:
            return JsonResponse({'code': 401, 'msg': '手机号授权失败'})

        pure_phone = phone_res.get('phone_info', {}).get('purePhoneNumber')

        # 3. 换取 OpenID
        login_url = f"https://api.weixin.qq.com/sns/jscode2session?appid={APP_ID}&secret={APP_SECRET}&js_code={code}&grant_type=authorization_code"
        login_res = requests.get(login_url).json()
        openid = login_res.get('openid')

        # 4. 查找或注册用户
        # 先通过手机号查找
        user = User.objects.filter(mobile=pure_phone).first()
        # 如果找不到，再通过openid查找
        if not user and openid:
            user = User.objects.filter(openid=openid).first()

        if not user:
            # 自动注册新用户
            # 如果openid为空，生成一个临时openid或使用手机号作为唯一标识
            if not openid:
                openid = f"phone_{pure_phone}"  # 使用手机号作为临时openid
            
            try:
                user = User.objects.create(
                    username=f"wx_{pure_phone[-4:]}",
                    mobile=pure_phone,
                    openid=openid,
                    nickname=f"用户{pure_phone[-4:]}",
                    last_login=datetime.now()
                )
            except Exception as create_error:
                # 如果因为openid唯一性冲突创建失败，尝试再次查找
                user = User.objects.filter(openid=openid).first()
                if not user:
                    raise create_error
        else:
            # 更新现有用户信息
            if openid and not user.openid:
                user.openid = openid
            if pure_phone:
                user.mobile = pure_phone
            user.last_login = datetime.now()
            user.save()

        # 5. 返回 Token 和用户信息
        token = generate_token(user.id, user.username)
        return JsonResponse({
            'code': 0,
            'msg': '登录成功',
            'data': {
                'token': token,
                'uid': user.id,
                'username': user.username,
                'mobile': user.mobile,
                'openid': user.openid or '',
                'userInfo': {
                    'id': user.id,
                    'username': user.username,
                    'nickname': user.nickname or '',
                    'mobile': user.mobile or '',
                    'avatar_url': user.avatar_url or ''
                }
            }
        })

    except Exception as e:
        return JsonResponse({'code': 500, 'msg': str(e)})


@csrf_exempt
@require_http_methods(["POST"])
def api_login_wx(request):
    """
    微信登录接口（仅使用 code，不获取手机号）
    用于降级方案：当无法获取手机号时使用
    POST /api/auth/login_wx 或 /login_wx
    """
    # 👇👇👇 这里的 AppID 和 Secret 必须填你自己的！👇👇👇
    APP_ID = 'wx584a350ed4b974a0'
    APP_SECRET = '11f0f8f7eed7e4cdc39ca4333bfd2134'

    try:
        data = json.loads(request.body)
        code = data.get('code')

        if not code:
            return JsonResponse({'code': 400, 'msg': '参数缺失：缺少code', 'data': None}, status=400)

        # 1. 换取 OpenID
        login_url = f"https://api.weixin.qq.com/sns/jscode2session?appid={APP_ID}&secret={APP_SECRET}&js_code={code}&grant_type=authorization_code"
        login_res = requests.get(login_url).json()
        
        # 检查微信接口返回的错误
        if login_res.get('errcode'):
            return JsonResponse({
                'code': 401, 
                'msg': f'微信登录失败: {login_res.get("errmsg", "未知错误")}', 
                'data': None
            }, status=401)
        
        openid = login_res.get('openid')
        session_key = login_res.get('session_key')
        unionid = login_res.get('unionid')

        if not openid:
            return JsonResponse({'code': 401, 'msg': '无法获取用户OpenID', 'data': None}, status=401)

        # 2. 查找或注册用户
        user = User.objects.filter(openid=openid).first()

        if not user:
            # 自动注册新用户（没有手机号）
            try:
                user = User.objects.create(
                    username=f"wx_{openid[-8:]}",
                    openid=openid,
                    unionid=unionid or None,
                    nickname=f"微信用户{openid[-4:]}",
                    last_login=datetime.now()
                )
            except Exception as create_error:
                # 如果因为openid唯一性冲突创建失败，尝试再次查找
                user = User.objects.filter(openid=openid).first()
                if not user:
                    return JsonResponse({'code': 500, 'msg': f'创建用户失败: {str(create_error)}', 'data': None}, status=500)
        else:
            # 更新现有用户信息
            if unionid and not user.unionid:
                user.unionid = unionid
            user.last_login = datetime.now()
            user.save()

        # 3. 返回 Token 和用户信息
        token = generate_token(user.id, user.username)
        return JsonResponse({
            'code': 0,
            'msg': '登录成功',
            'data': {
                'token': token,
                'uid': user.id,
                'username': user.username,
                'mobile': user.mobile or '',
                'openid': user.openid or '',
                'userInfo': {
                    'id': user.id,
                    'username': user.username,
                    'nickname': user.nickname or '',
                    'mobile': user.mobile or '',
                    'avatar_url': user.avatar_url or ''
                }
            }
        })

    except json.JSONDecodeError:
        return JsonResponse({'code': 400, 'msg': '请求数据格式错误', 'data': None}, status=400)
    except Exception as e:
        return JsonResponse({'code': 500, 'msg': f'服务器错误: {str(e)}', 'data': None}, status=500)


@csrf_exempt
@require_http_methods(["GET"])
def api_get_sheep_by_ear_tag(request):
    """
    根据耳标编号查询羊只信息（供扫码溯源使用）
    GET /api/sheep/trace?ear_tag=TY-2026-001
    """
    try:
        ear_tag = request.GET.get('ear_tag', '').strip()
        
        if not ear_tag:
            return JsonResponse({'error': '耳标编号不能为空'}, status=400)
        
        # 查询羊只
        try:
            sheep = Sheep.objects.get(ear_tag=ear_tag)
        except Sheep.DoesNotExist:
            return JsonResponse({'error': f'未找到耳标编号为 {ear_tag} 的羊只'}, status=404)
        
        # 构造返回数据
        result = {
            'id': sheep.id,
            'ear_tag': sheep.ear_tag,
            'gender': sheep.get_gender_display(),
            'weight': float(sheep.weight),
            'height': float(sheep.height),
            'length': float(sheep.length),
            'qr_code': request.build_absolute_uri(sheep.qr_code.url) if sheep.qr_code else None,
            'breeder': {
                'id': sheep.breeder.id if sheep.breeder else None,
                'name': sheep.breeder.name if sheep.breeder else None,
                'phone': sheep.breeder.phone if sheep.breeder else None,
            } if sheep.breeder else None
        }
        
        return JsonResponse(result)
    
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

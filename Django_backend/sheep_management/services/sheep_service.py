"""
羊只业务逻辑 Service
所有方法为纯业务逻辑，不依赖任何 HTTP Request/Response 对象。
通过 raise SheepError 传递错误。
"""
import re
from datetime import date

from django.db.models import Q

from ..models import Sheep, VaccinationHistory, GrowthRecord, FeedingRecord


class SheepError(Exception):
    """羊只业务异常"""
    def __init__(self, message, code=400, http_status=400):
        self.message = message
        self.code = code          # 业务错误码
        self.http_status = http_status  # HTTP 状态码
        super().__init__(self.message)


class SheepService:
    """羊只相关业务逻辑"""

    # ========================
    #  公开方法
    # ========================

    @staticmethod
    def search_sheep(gender=None, weight=None, height=None, length=None):
        """
        搜索羊只
        :param gender: 性别筛选（支持中文/英文/数字）
        :param weight: 体重范围（如 "30-50kg"）
        :param height: 身高范围（如 "60-80cm"）
        :param length: 体长范围
        :return: list[dict]
        """
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
            weight_range = SheepService._parse_range(weight)
            if weight_range:
                query &= Q(weight__gte=weight_range[0], weight__lte=weight_range[1])

        if height:
            height_range = SheepService._parse_range(height)
            if height_range:
                query &= Q(height__gte=height_range[0], height__lte=height_range[1])

        if length:
            length_range = SheepService._parse_range(length)
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
                'length': float(sheep.length),
                'price': float(sheep.price),
            })
        return result

    @staticmethod
    def get_sheep_by_id(sheep_id):
        """
        根据ID获取羊只详情
        :param sheep_id: 羊只ID
        :return: dict
        """
        if not sheep_id:
            raise SheepError('缺少羊只ID参数')

        try:
            sheep = Sheep.objects.select_related('owner').get(pk=sheep_id)
        except Sheep.DoesNotExist:
            raise SheepError('羊只不存在', code=404, http_status=404)

        return {
            'id': sheep.id,
            'gender': sheep.get_gender_display(),  # 显示为中文
            'weight': float(sheep.weight),
            'height': float(sheep.height),
            'length': float(sheep.length),
            'birth_date': sheep.birth_date.strftime('%Y-%m-%d') if sheep.birth_date else '',
            'price': float(sheep.price),
            'ear_tag': sheep.ear_tag or '',
            'qr_code': sheep.qr_code.url if sheep.qr_code else '',
            'farm_name': sheep.farm_name or '宁夏盐池滩羊核心产区',  # 如果真实农场没填给个默认
            'breeder_name': sheep.owner.nickname or sheep.owner.username if sheep.owner else '官方牧场',
            'image': sheep.image.url if sheep.image else '',
            'video': sheep.video.url if sheep.video else '',
        }

    @staticmethod
    def get_vaccine_records(sheep_id):
        """
        获取羊只疫苗接种记录
        :param sheep_id: 羊只ID
        :return: list[dict]
        """
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
        return result

    @staticmethod
    def get_sheep_with_growth(sheep_id):
        """
        获取羊只完整数据（含生长记录、喂养记录、疫苗接种记录）
        :param sheep_id: 羊只ID
        :return: dict
        """
        try:
            sheep_id = int(sheep_id)
        except (ValueError, TypeError):
            raise SheepError('无效的羊只ID')

        try:
            sheep = Sheep.objects.get(pk=sheep_id)
        except Sheep.DoesNotExist:
            raise SheepError('羊只不存在', code=404, http_status=404)

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

        return {
            'id': sheep.id,
            'gender': sheep.get_gender_display() if sheep.gender is not None else '',  # 显示为中文
            'weight': float(sheep.weight) if sheep.weight is not None else 0.0,
            'height': float(sheep.height) if sheep.height is not None else 0.0,
            'length': float(sheep.length) if sheep.length is not None else 0.0,
            'price': float(sheep.price) if sheep.price is not None else 0.0,
            'growth_records': growth_data,
            'feeding_records': feeding_data,
            'vaccination_records': vaccination_data
        }

    @staticmethod
    def get_sheep_by_ear_tag(ear_tag, build_absolute_uri=None):
        """
        根据耳标编号查询羊只信息（供扫码溯源使用）
        :param ear_tag: 耳标编号
        :param build_absolute_uri: 用于构建绝对URI的回调函数（可选）
        :return: dict
        """
        if not ear_tag:
            raise SheepError('耳标编号不能为空')

        try:
            sheep = Sheep.objects.get(ear_tag=ear_tag)
        except Sheep.DoesNotExist:
            raise SheepError(f'未找到耳标编号为 {ear_tag} 的羊只', code=404, http_status=404)

        # 构造返回数据
        qr_code_url = None
        if sheep.qr_code and build_absolute_uri:
            qr_code_url = build_absolute_uri(sheep.qr_code.url)

        result = {
            'id': sheep.id,
            'ear_tag': sheep.ear_tag,
            'gender': sheep.get_gender_display(),
            'weight': float(sheep.weight),
            'height': float(sheep.height),
            'length': float(sheep.length),
            'qr_code': qr_code_url,
            'breeder': {
                'id': sheep.breeder.id if sheep.breeder else None,
                'name': sheep.breeder.name if sheep.breeder else None,
                'phone': sheep.breeder.phone if sheep.breeder else None,
            } if sheep.breeder else None
        }
        return result

    @staticmethod
    def create_sheep(owner, data, image=None, video=None):
        """
        创建羊只
        :param owner: 养殖户用户对象
        :param data: 羊只数据
        :param image: 羊只照片
        :param video: 羊只视频
        :return: dict
        """
        required_fields = ['gender', 'weight', 'height', 'length']
        for field in required_fields:
            if field not in data:
                raise SheepError(f'缺少必填字段: {field}')

        try:
            sheep = Sheep.objects.create(
                ear_tag=data.get('ear_tag'),
                gender=int(data['gender']),
                breed=data.get('breed', '滩羊'),
                health_status=data.get('health_status', '健康'),
                weight=float(data['weight']),
                height=float(data['height']),
                length=float(data['length']),
                birth_date=data.get('birth_date'),
                farm_name=data.get('farm_name'),
                price=float(data.get('price', 0)),
                owner=owner
            )

            if image:
                sheep.image = image
            if video:
                sheep.video = video
            sheep.save()

            return SheepService.get_sheep_by_id(sheep.id)
        except Exception as e:
            raise SheepError(f'创建羊只失败: {str(e)}')

    @staticmethod
    def update_sheep(sheep_id, owner, data, image=None, video=None):
        """
        更新羊只信息
        :param sheep_id: 羊只ID
        :param owner: 养殖户用户对象
        :param data: 羊只数据
        :param image: 羊只照片
        :param video: 羊只视频
        :return: dict
        """
        try:
            sheep = Sheep.objects.get(pk=sheep_id)
        except Sheep.DoesNotExist:
            raise SheepError('羊只不存在', code=404, http_status=404)

        # 验证权限：只能修改自己的羊只
        if sheep.owner != owner:
            raise SheepError('无权修改其他养殖户的羊只', code=403, http_status=403)

        # 更新字段
        update_fields = ['ear_tag', 'gender', 'breed', 'health_status', 'weight', 'height', 'length', 'birth_date', 'farm_name', 'price']
        for field in update_fields:
            if field in data:
                if field in ['gender', 'weight', 'height', 'length', 'price']:
                    setattr(sheep, field, float(data[field]) if field != 'gender' else int(data[field]))
                else:
                    setattr(sheep, field, data[field])

        if image:
            sheep.image = image
        if video:
            sheep.video = video

        sheep.save()
        return SheepService.get_sheep_by_id(sheep.id)

    @staticmethod
    def delete_sheep(sheep_id, owner):
        """
        删除羊只
        :param sheep_id: 羊只ID
        :param owner: 养殖户用户对象
        :return: dict
        """
        try:
            sheep = Sheep.objects.get(pk=sheep_id)
        except Sheep.DoesNotExist:
            raise SheepError('羊只不存在', code=404, http_status=404)

        # 验证权限：只能删除自己的羊只
        if sheep.owner != owner:
            raise SheepError('无权删除其他养殖户的羊只', code=403, http_status=403)

        sheep.delete()
        return {'code': 0, 'msg': '删除成功', 'data': None}

    @staticmethod
    def get_breeder_sheep_list(owner):
        """
        获取养殖户自己的羊只列表
        :param owner: 养殖户用户对象
        :return: list[dict]
        """
        sheep_list = Sheep.objects.filter(owner=owner)
        result = []
        for sheep in sheep_list:
            result.append({
                'id': sheep.id,
                'ear_tag': sheep.ear_tag or '',
                'gender': sheep.get_gender_display(),
                'weight': float(sheep.weight),
                'height': float(sheep.height),
                'length': float(sheep.length),
                'birth_date': sheep.birth_date.strftime('%Y-%m-%d') if sheep.birth_date else '',
                'farm_name': sheep.farm_name or '',
                'price': float(sheep.price),
                'image': sheep.image.url if sheep.image else '',
                'video': sheep.video.url if sheep.video else '',
            })
        return result

    @staticmethod
    def count_sheep(gender=None, weights=None, heights=None, lengths=None):
        """
        获取符合条件的羊只数量（支持多选筛选）
        :param gender: 性别筛选（支持中文/英文/数字）
        :param weights: 体重范围列表（如 ['20-30kg', '30-40kg']）
        :param heights: 体高范围列表（如 ['55-65cm', '65-75cm']）
        :param lengths: 体长范围列表（如 ['60-70cm', '70-80cm']）
        :return: int 符合条件的羊只数量
        """
        query = Q()
        
        # 性别筛选（单选）
        if gender:
            if gender in ['公', 'male', '雄性', '1', 1]:
                query &= Q(gender=1)
            elif gender in ['母', 'female', '雌性', '0', 0]:
                query &= Q(gender=0)
            else:
                try:
                    gender_int = int(gender)
                    if gender_int in [0, 1]:
                        query &= Q(gender=gender_int)
                except (ValueError, TypeError):
                    pass
        
        # 体重筛选（多选 - OR关系）
        if weights and len(weights) > 0:
            weight_query = Q()
            for weight in weights:
                weight_range = SheepService._parse_range(weight)
                if weight_range:
                    weight_query |= Q(weight__gte=weight_range[0], weight__lte=weight_range[1])
            query &= weight_query
        
        # 体高筛选（多选 - OR关系）
        if heights and len(heights) > 0:
            height_query = Q()
            for height in heights:
                height_range = SheepService._parse_range(height)
                if height_range:
                    height_query |= Q(height__gte=height_range[0], height__lte=height_range[1])
            query &= height_query
        
        # 体长筛选（多选 - OR关系）
        if lengths and len(lengths) > 0:
            length_query = Q()
            for length in lengths:
                length_range = SheepService._parse_range(length)
                if length_range:
                    length_query |= Q(length__gte=length_range[0], length__lte=length_range[1])
            query &= length_query
        
        return Sheep.objects.filter(query).count()

    @staticmethod
    def search_sheep_multi(gender=None, weights=None, heights=None, lengths=None):
        """
        多选筛选搜索羊只（支持体重、体高、体长多选）
        :param gender: 性别筛选
        :param weights: 体重范围列表
        :param heights: 体高范围列表
        :param lengths: 体长范围列表
        :return: list[dict] 羊只列表
        """
        query = Q()
        
        # 性别筛选
        if gender:
            if gender in ['公', 'male', '雄性', '1', 1]:
                query &= Q(gender=1)
            elif gender in ['母', 'female', '雌性', '0', 0]:
                query &= Q(gender=0)
            else:
                try:
                    gender_int = int(gender)
                    if gender_int in [0, 1]:
                        query &= Q(gender=gender_int)
                except (ValueError, TypeError):
                    pass
        
        # 体重筛选（多选 - OR关系）
        if weights and len(weights) > 0:
            weight_query = Q()
            for weight in weights:
                weight_range = SheepService._parse_range(weight)
                if weight_range:
                    weight_query |= Q(weight__gte=weight_range[0], weight__lte=weight_range[1])
            query &= weight_query
        
        # 体高筛选（多选 - OR关系）
        if heights and len(heights) > 0:
            height_query = Q()
            for height in heights:
                height_range = SheepService._parse_range(height)
                if height_range:
                    height_query |= Q(height__gte=height_range[0], height__lte=height_range[1])
            query &= height_query
        
        # 体长筛选（多选 - OR关系）
        if lengths and len(lengths) > 0:
            length_query = Q()
            for length in lengths:
                length_range = SheepService._parse_range(length)
                if length_range:
                    length_query |= Q(length__gte=length_range[0], length__lte=length_range[1])
            query &= length_query
        
        sheep_list = Sheep.objects.filter(query)
        
        result = []
        for sheep in sheep_list:
            result.append({
                'id': sheep.id,
                'ear_tag': sheep.ear_tag or '',
                'gender': sheep.get_gender_display(),
                'weight': float(sheep.weight),
                'height': float(sheep.height),
                'length': float(sheep.length),
                'price': float(sheep.price),
                'image': sheep.image.url if sheep.image else '',
                'farm_name': sheep.farm_name or '宁夏盐池滩羊核心产区',
                'breeder_name': sheep.owner.nickname or sheep.owner.username if sheep.owner else '官方牧场',
            })
        return result

    # ========================
    #  私有方法
    # ========================

    @staticmethod
    def _parse_range(range_str):
        """解析范围字符串，如 '30-50kg' → (30.0, 50.0)"""
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

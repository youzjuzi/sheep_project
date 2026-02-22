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
            if gender in ['公', '雄性', 'male', '1', 1]:
                query &= Q(gender=1)
            elif gender in ['母', '雌性', 'female', '0', 0]:
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
            sheep = Sheep.objects.get(pk=sheep_id)
        except Sheep.DoesNotExist:
            raise SheepError('羊只不存在', code=404, http_status=404)

        return {
            'id': sheep.id,
            'gender': sheep.get_gender_display(),  # 显示为中文
            'weight': float(sheep.weight),
            'height': float(sheep.height),
            'length': float(sheep.length),
            'price': float(sheep.price),
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

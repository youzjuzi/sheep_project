"""
用户业务逻辑 Service
"""
import uuid

import boto3
from botocore.config import Config
from django.conf import settings

from ..models import User
from ..utils import verify_token


class UserError(Exception):
    """用户业务异常"""
    def __init__(self, message, code=400, http_status=400):
        self.message = message
        self.code = code
        self.http_status = http_status
        super().__init__(self.message)


def _get_r2_client():
    """获取 R2 S3 客户端"""
    return boto3.client(
        's3',
        endpoint_url=f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        config=Config(signature_version='s3v4'),
        region_name='auto',
    )


class UserService:
    """用户相关业务逻辑"""

    # ========================
    #  通用方法
    # ========================

    @staticmethod
    def get_user_by_token(token):
        """通过 token 获取用户对象"""
        if not token:
            raise UserError('缺少 token', code=401, http_status=401)

        payload = verify_token(token)
        if not payload:
            raise UserError('token 无效或已过期', code=401, http_status=401)

        try:
            return User.objects.get(pk=payload.get('user_id'))
        except User.DoesNotExist:
            raise UserError('用户不存在', code=404, http_status=404)

    @staticmethod
    def get_user_info(token):
        """获取当前用户信息（完整），用于通用展示和个人资料编辑页"""
        user = UserService.get_user_by_token(token)
        return UserService._build_profile(user)

    # ========================
    #  头像上传（R2 Presigned URL）
    # ========================

    @staticmethod
    def generate_avatar_upload_url(token, file_ext='.jpg', content_type='image/jpeg'):
        """
        生成 R2 预签名上传链接
        :param token: JWT token
        :param file_ext: 文件扩展名（.jpg / .png / .gif / .webp）
        :param content_type: MIME 类型
        :return: dict 包含 upload_url 和 object_key
        """
        user = UserService.get_user_by_token(token)

        # 校验扩展名
        allowed_exts = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
        if file_ext.lower() not in allowed_exts:
            raise UserError('仅支持 JPG、PNG、GIF、WebP 格式')

        # 生成对象 key：avatars/sheep/{uuid}.jpg
        unique_name = uuid.uuid4().hex[:12]
        object_key = f"avatars/sheep/{unique_name}{file_ext.lower()}"

        # 生成预签名 URL（有效期 10 分钟）
        client = _get_r2_client()
        upload_url = client.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': settings.R2_BUCKET_NAME,
                'Key': object_key,
                'ContentType': content_type,
            },
            ExpiresIn=600,  # 10 分钟
        )

        # 拼接公开访问地址
        public_url = f"{settings.R2_PUBLIC_URL.rstrip('/')}/{object_key}"

        return {
            'upload_url': upload_url,     # 小程序用这个地址做 PUT 上传
            'object_key': object_key,     # 上传后回调需要这个 key
            'public_url': public_url,     # 上传成功后的公开访问地址
        }

    @staticmethod
    def confirm_avatar_upload(token, object_key):
        """
        确认头像上传完成，更新数据库
        :param token: JWT token
        :param object_key: R2 中的对象 key
        :return: dict 更新后的用户信息
        """
        user = UserService.get_user_by_token(token)

        if not object_key:
            raise UserError('缺少 object_key 参数')

        # 兼容前端可能传完整 URL 的情况
        if object_key.startswith('http'):
            # 如果配置的 public_url 没有以 / 结尾，补充一下
            public_base = settings.R2_PUBLIC_URL
            if not public_base.endswith('/'):
                public_base += '/'
            object_key = object_key.replace(public_base, '')

        # 如果还是带有协议前缀，再处理一下防万一
        if "://" in object_key:
             object_key = object_key.split("://")[-1]
             # 再把域名劈掉
             if "/" in object_key:
                  object_key = object_key.split("/", 1)[-1]
            
        object_key = object_key.lstrip('/')

        # 验证 key 是否在规定的目录下
        expected_prefix = "avatars/sheep/"
        if not object_key.startswith(expected_prefix):
            raise UserError(f'无权操作该文件: {object_key}', code=403, http_status=403)

        # （可选）验证文件是否真的存在于 R2
        try:
            client = _get_r2_client()
            client.head_object(
                Bucket=settings.R2_BUCKET_NAME,
                Key=object_key,
            )
        except Exception as e:
            raise UserError(f'文件不存在，请重新上传: {str(e)}')

        # 删除旧头像（如果存在且也在 R2）
        if user.avatar_url and settings.R2_PUBLIC_URL in user.avatar_url:
            old_key = user.avatar_url.replace(
                f"{settings.R2_PUBLIC_URL.rstrip('/')}/", ''
            )
            old_key = old_key.lstrip('/')
            try:
                client.delete_object(
                    Bucket=settings.R2_BUCKET_NAME,
                    Key=old_key,
                )
            except Exception:
                pass  # 删除失败不影响流程

        # 更新数据库
        public_url = f"{settings.R2_PUBLIC_URL.rstrip('/')}/{object_key}"
        user.avatar_url = public_url
        user.save(update_fields=['avatar_url'])

        return UserService._build_profile(user)

    # ========================
    #  更新资料
    # ========================

    @staticmethod
    def update_profile(token, nickname=None, gender=None, mobile=None, description=None, birthday=None):
        """更新用户基本资料"""
        user = UserService.get_user_by_token(token)

        if nickname is not None:
            nickname = nickname.strip()
            if not nickname:
                raise UserError('昵称不能为空')
            if len(nickname) > 50:
                raise UserError('昵称不能超过50个字符')
            user.nickname = nickname

        if gender is not None:
            if gender not in [0, 1, 2]:
                raise UserError('性别参数无效')
            user.gender = gender

        if mobile is not None:
            mobile = mobile.strip()
            if mobile and len(mobile) > 20:
                raise UserError('手机号格式不正确')
            user.mobile = mobile or None

        if description is not None:
            if len(description) > 200:
                raise UserError('个人简介不能超过200个字符')
            user.description = description

        if birthday is not None:
            # 支持空字符串清空生日
            if birthday == '':
                user.birthday = None
            else:
                from datetime import datetime
                try:
                    user.birthday = datetime.strptime(birthday, '%Y-%m-%d').date()
                except (ValueError, TypeError):
                    raise UserError('生日格式不正确，请使用 YYYY-MM-DD')

        user.save()

        return UserService._build_profile(user)

    @staticmethod
    def apply_breeder(token, mobile):
        """申请成为养殖户"""
        user = UserService.get_user_by_token(token)
        
        mobile = mobile.strip() if mobile else ''
        if not mobile or len(mobile) > 20:
            raise UserError('请提供有效的手机号')
        
        # 即使之前是不同角色，这里申请后我们统一标记为 role=1, is_verified=False 等待后台审核
        user.mobile = mobile
        user.role = 1
        user.is_verified = False
        user.save()
        
        return UserService._build_profile(user)

    # ========================
    #  私有方法
    # ========================

    @staticmethod
    def recharge(token, amount):
        """用户余额充值"""
        from decimal import Decimal, InvalidOperation
        user = UserService.get_user_by_token(token)
        try:
            amt = Decimal(str(amount))
        except (InvalidOperation, ValueError):
            raise UserError('充值金额无效')
        if amt <= 0:
            raise UserError('充值金额必须大于 0')
        if amt > Decimal('9999'):
            raise UserError('单次充值金额不能超过 9999 元')
        user.balance = user.balance + amt
        user.save(update_fields=['balance'])
        return {
            'balance': float(user.balance),
            'recharged': float(amt),
        }

    @staticmethod
    def _build_profile(user):
        """构建用户完整资料（统一返回所有字段）"""
        from ..models import Order
        from django.db.models import Sum

        # 计算累计消费 (只要状态为 paid 或 completed)
        total_consumed = Order.objects.filter(
            user=user, 
            status__in=['paid', 'completed']
        ).aggregate(total=Sum('total_amount'))['total'] or 0

        return {
            'id': user.id,
            'role': user.role,
            'is_verified': user.is_verified,
            'username': user.username or '',
            'nickname': user.nickname or '',
            'description': user.description or '',
            'birthday': user.birthday.strftime('%Y-%m-%d') if user.birthday else '',
            'mobile': user.mobile or '',
            'avatar_url': user.avatar_url or '',
            'gender': user.gender or 0,
            'balance': float(user.balance),
            'total_consumed': float(total_consumed)
        }

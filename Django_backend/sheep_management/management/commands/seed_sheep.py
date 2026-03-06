"""
批量添羊命令：为每个角色为"养殖户"的用户批量添加 200 只羊
用法：python manage.py seed_sheep
     python manage.py seed_sheep --count 100   # 自定义每人添加数量
     python manage.py seed_sheep --clear        # 添加前先清空所有羊只数据
"""
import random
import string
from datetime import date, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

from sheep_management.models import Sheep
from sheep_management.models.user import User


def _unique_ear_tag(owner_id: int, used_tags: set) -> str:
    """
    生成不重复的耳标号。
    格式：TY + 养殖户ID(3位) + 年月日(6位) + 4位随机大写字母/数字
    每次生成后检查 used_tags 集合（批次内去重），若重复则重新生成。
    """
    prefix = 'TY'
    owner_part = str(owner_id).zfill(3)
    date_part = date.today().strftime('%y%m%d')   # 6 位日期，如 260306
    chars = string.ascii_uppercase + string.digits  # 36 个字符

    while True:
        rand_part = ''.join(random.choices(chars, k=4))   # 36^4 ≈ 168 万种组合
        tag = f'{prefix}{owner_part}{date_part}{rand_part}'
        if tag not in used_tags:
            used_tags.add(tag)
            return tag


class Command(BaseCommand):
    help = '为每个"养殖户"用户批量添加 200 只羊'

    def add_arguments(self, parser):
        parser.add_argument(
            '--count',
            type=int,
            default=200,
            help='每位养殖户添加的羊只数量（默认 200）',
        )
        parser.add_argument(
            '--clear',
            action='store_true',
            help='添加前先清空数据库中所有羊只数据',
        )

    def handle(self, *args, **options):
        count_per_breeder = options['count']

        # ── 0. 可选：清空旧数据 ──────────────────────────────────────
        if options['clear']:
            deleted, _ = Sheep.objects.all().delete()
            self.stdout.write(self.style.WARNING(f'已清空 {deleted} 条羊只数据'))

        # ── 1. 查询所有养殖户 ────────────────────────────────────────
        breeders = User.objects.filter(role=1)
        if not breeders.exists():
            self.stdout.write(self.style.ERROR('数据库中没有角色为"养殖户"的用户，请先添加养殖户。'))
            return

        self.stdout.write(f'找到 {breeders.count()} 位养殖户，每人添加 {count_per_breeder} 只羊……')

        # ── 2. 读取数据库中已存在的耳标，用于全局去重 ────────────────
        existing_tags: set = set(Sheep.objects.values_list('ear_tag', flat=True))
        self.stdout.write(f'数据库中已有 {len(existing_tags)} 条耳标记录，将自动跳过重复值。')

        today = date.today()
        total_created = 0

        # ── 3. 按养殖户循环，每人批量创建 ────────────────────────────
        for breeder in breeders:
            sheep_batch = []

            for _ in range(count_per_breeder):
                # 耳标：全局去重（existing_tags 贯穿整个脚本）
                tag = _unique_ear_tag(breeder.id, existing_tags)

                # 性别：随机 0=母 / 1=公
                gender = random.randint(0, 1)

                # 体重：30 ~ 80 kg，保留 1 位小数
                weight = round(random.uniform(30.0, 80.0), 1)

                # 身高：55 ~ 80 cm
                height = round(random.uniform(55.0, 80.0), 1)

                # 体长：60 ~ 100 cm
                length = round(random.uniform(60.0, 100.0), 1)

                # 出生日期：6 个月 ~ 3 年前
                days_ago = random.randint(180, 1095)
                birth_date = today - timedelta(days=days_ago)

                # 价格：600 ~ 2500 元，保留 2 位小数
                price = Decimal(str(round(random.uniform(600.0, 2500.0), 2)))

                # 农场名称：沿用养殖户昵称或用户名
                farm_name = f'{breeder.nickname or breeder.username}的农场'

                sheep_batch.append(Sheep(
                    ear_tag=tag,
                    gender=gender,
                    health_status='健康',
                    weight=weight,
                    height=height,
                    length=length,
                    birth_date=birth_date,
                    price=price,
                    farm_name=farm_name,
                    owner=breeder,
                ))

            # 单个养殖户的数据在一个事务内批量写入
            with transaction.atomic():
                Sheep.objects.bulk_create(sheep_batch)

            total_created += len(sheep_batch)
            breeder_name = breeder.nickname or breeder.username
            self.stdout.write(
                self.style.SUCCESS(
                    f'  ✔ 养殖户 [{breeder.id}] {breeder_name} '
                    f'→ 成功添加 {len(sheep_batch)} 只羊'
                )
            )

        # ── 4. 汇总 ──────────────────────────────────────────────────
        self.stdout.write(
            self.style.SUCCESS(
                f'\n全部完成！共为 {breeders.count()} 位养殖户添加了 {total_created} 只羊。'
            )
        )

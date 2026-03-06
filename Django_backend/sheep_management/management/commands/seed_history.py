"""
周期性历史数据生成命令：
  针对每只养殖户的羊，以 birth_date 为"入栏时间"起点，直到今天，生成：
    - 生长记录（GrowthRecord）  ：每月 1 条，体重单调递增
    - 喂养记录（FeedingRecord） ：每天 1 条，全部收集到大列表后 bulk_create(batch_size=5000)
    - 疫苗记录（VaccinationHistory）：第 1/3/6/9/12 个月固定节点

用法：
    python manage.py seed_history           # 生成所有数据
    python manage.py seed_history --clear   # 先清空三张表再插入
"""

import random
from datetime import date, timedelta

from django.core.management.base import BaseCommand
from django.db import connection, transaction

from sheep_management.models import (
    Sheep, GrowthRecord, FeedingRecord, VaccineType, VaccinationHistory,
)


# ── 饲料配置：(类型, 单位, 每日合理用量范围) ──────────────────────────
FEED_OPTIONS = [
    ('青草',    'kg',  (3.0,  8.0)),
    ('玉米秸秆', 'kg', (2.0,  5.0)),
    ('精饲料',  'kg',  (0.5,  2.0)),
    ('燕麦干草', '捆', (1.0,  3.0)),
    ('豆粕',    'kg',  (0.3,  1.0)),
    ('麦麸',    'kg',  (0.5,  1.5)),
    ('胡萝卜',  'kg',  (0.5,  2.0)),
    ('盐砖',    'g',   (50.0, 100.0)),
]

# ── 疫苗接种节点：(入栏后第N月, 疫苗名, 剂量ml, 有效期天数, 说明) ──
VACCINE_SCHEDULE = [
    (1,  '口蹄疫疫苗（O型+亚洲I型）', 2.0, 180,
     '预防 O 型和亚洲 I 型口蹄疫，首次免疫'),
    (3,  '三联四防苗',                  5.0, 365,
     '预防羊快疫、猝疽、肠毒血症、羔羊痢疾（梭菌性疾病）'),
    (6,  '口蹄疫疫苗（O型+亚洲I型）', 2.0, 180,
     '口蹄疫加强免疫（6 个月补注）'),
    (9,  '羊痘弱毒活疫苗',              1.0, 365,
     '预防羊痘，尾根皮内注射'),
    (12, '三联四防苗',                  5.0, 365,
     '年度梭菌病加强免疫'),
    (12, '布鲁氏菌病活疫苗（S2株）',   1.0, 730,
     '预防布鲁氏菌病，口服免疫'),
]


# ── 工具函数 ──────────────────────────────────────────────────────────

def _add_months(d: date, months: int) -> date:
    """日期加 N 个月，自动处理月末日期溢出（如 1月31日+1月→2月28日）。"""
    month = d.month - 1 + months
    year  = d.year + month // 12
    month = month % 12 + 1
    # 当月最大天数
    import calendar
    max_day = calendar.monthrange(year, month)[1]
    return date(year, month, min(d.day, max_day))


def _month_first_days(start: date, end: date):
    """生成从 start 到 end（含）之间每个月的 1 日列表。"""
    days = []
    cur = date(start.year, start.month, 1)
    while cur <= end:
        days.append(cur)
        cur = _add_months(cur, 1)
    return days


def _monotone_weights(start_w: float, end_w: float, n: int):
    """
    生成 n 个单调递增的体重值（float）。
    区间 [start_w, end_w] 内随机划分 n-1 个断点，排序后得到严格递增序列。
    """
    if n == 1:
        return [round(end_w, 1)]
    total_gain = max(end_w - start_w, 0.1)          # 至少增长 0.1 kg
    # 生成 n-1 个随机断点并排序
    breaks = sorted(random.uniform(0, total_gain) for _ in range(n - 1))
    # 映射为累计值
    values = [start_w] + [round(start_w + b, 1) for b in breaks]
    values.append(round(end_w, 1))                  # 最后一条精确等于当前体重
    return values  # 长度 n+1 → 取前 n 个实际使用（最后一个是终点）


def _monotone_dim(start_v: float, end_v: float, n: int):
    """同 _monotone_weights，用于 height / length。"""
    return _monotone_weights(start_v, end_v, n)


# ── 管理命令主体 ─────────────────────────────────────────────────────

class Command(BaseCommand):
    help = '为每只养殖户的羊生成生长/喂养/疫苗历史数据'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='插入前先清空 GrowthRecord / FeedingRecord / VaccinationHistory 三张表',
        )

    # ------------------------------------------------------------------
    def handle(self, *args, **options):
        today = date.today()

        # ── 0. 可选清空 ───────────────────────────────────────────────
        if options['clear']:
            gc = GrowthRecord.objects.all().delete()[0]
            fc = FeedingRecord.objects.all().delete()[0]
            vc = VaccinationHistory.objects.all().delete()[0]
            self.stdout.write(self.style.WARNING(
                f'已清空：生长记录 {gc} 条 | 喂养记录 {fc} 条 | 疫苗记录 {vc} 条'
            ))

        # ── 1. 确保疫苗种类存在 ───────────────────────────────────────
        self.stdout.write('── 步骤 1/4：初始化疫苗种类 ──')
        vaccine_map: dict[str, VaccineType] = {}
        for _, vname, _, validity, desc in VACCINE_SCHEDULE:
            obj, created = VaccineType.objects.get_or_create(
                name=vname,
                defaults={
                    'description':   desc,
                    'validity_days': validity,
                    'manufacturer':  '农业农村部批准厂家',
                },
            )
            vaccine_map[vname] = obj
            if created:
                self.stdout.write(f'  ✚ 新建疫苗种类：{vname}')
            else:
                self.stdout.write(f'  ✔ 已存在：{vname}')

        # ── 2. 查询羊只 ───────────────────────────────────────────────
        self.stdout.write('\n── 步骤 2/4：查询养殖户羊只 ──')
        sheep_qs = Sheep.objects.filter(owner__role=1).select_related('owner').order_by('id')
        total_sheep = sheep_qs.count()
        if total_sheep == 0:
            self.stdout.write(self.style.ERROR('未找到养殖户的羊只，请先运行 seed_sheep。'))
            return
        self.stdout.write(f'  共 {total_sheep} 只羊，开始生成数据……\n')

        # ── 3. 遍历每只羊，构建三种记录 ──────────────────────────────
        self.stdout.write('── 步骤 3/4：生成记录（耗时较长，请耐心等待）──')

        growth_list:  list[GrowthRecord]       = []
        all_feeding:  list[FeedingRecord]      = []
        vaccine_list: list[VaccinationHistory] = []

        # 用于每日喂养随机选饲料（预先构建索引，避免重复计算）
        feed_count = len(FEED_OPTIONS)

        for idx, sheep in enumerate(sheep_qs.iterator(chunk_size=200), start=1):

            # 入栏时间：优先 birth_date，否则回退到 1 年前
            start_date: date = sheep.birth_date or (today - timedelta(days=365))
            if start_date >= today:
                continue  # 跳过未来日期（异常数据）

            owner_name = sheep.owner.nickname or sheep.owner.username

            # ── A. 生长记录 ──────────────────────────────────────────
            month_days = _month_first_days(start_date, today)
            n_months   = len(month_days)

            # 起始形态：羔羊约 4~6 kg / 30~40 cm / 35~45 cm
            start_w = round(random.uniform(4.0, 6.0), 1)
            start_h = round(random.uniform(30.0, 40.0), 1)
            start_l = round(random.uniform(35.0, 45.0), 1)

            weights = _monotone_weights(start_w, sheep.weight, n_months)
            heights = _monotone_dim(start_h, sheep.height,     n_months)
            lengths = _monotone_dim(start_l, sheep.length,     n_months)

            for i, rec_date in enumerate(month_days):
                growth_list.append(GrowthRecord(
                    sheep=sheep,
                    record_date=rec_date,
                    weight=weights[i],
                    height=heights[i],
                    length=lengths[i],
                ))

            # ── B. 喂养记录：每天 1 条 ────────────────────────────────
            cur_day = start_date
            while cur_day <= today:
                fi = random.randrange(feed_count)
                ftype, unit, (lo, hi) = FEED_OPTIONS[fi]
                all_feeding.append(FeedingRecord(
                    sheep=sheep,
                    feed_type=ftype,
                    feed_date=cur_day,
                    amount=round(random.uniform(lo, hi), 1),
                    unit=unit,
                ))
                cur_day += timedelta(days=1)

            # ── C. 疫苗记录：固定月份节点 ─────────────────────────────
            veterinarian = f'{owner_name}农场兽医'
            for month_offset, vname, dosage, validity, _ in VACCINE_SCHEDULE:
                vacc_date = _add_months(start_date, month_offset)
                if vacc_date > today:
                    continue  # 还没到接种时间，跳过
                expiry_date = _add_months(vacc_date, validity // 30)
                vaccine_list.append(VaccinationHistory(
                    sheep=sheep,
                    vaccine=vaccine_map[vname],
                    vaccination_date=vacc_date,
                    expiry_date=expiry_date,
                    dosage=dosage,
                    administered_by=veterinarian,
                    notes=f'常规免疫计划：入栏后第 {month_offset} 个月',
                ))

            # 每处理 100 只打印一次进度
            if idx % 100 == 0:
                self.stdout.write(
                    f'  [{idx}/{total_sheep}] 已处理 {idx} 只羊 | '
                    f'生长记录: {len(growth_list)} | '
                    f'喂养记录: {len(all_feeding)} | '
                    f'疫苗记录: {len(vaccine_list)}'
                )

        self.stdout.write(
            f'\n  ✔ 全部 {total_sheep} 只羊处理完毕：\n'
            f'    生长记录待写入：{len(growth_list):,} 条\n'
            f'    喂养记录待写入：{len(all_feeding):,} 条\n'
            f'    疫苗记录待写入：{len(vaccine_list):,} 条\n'
        )

        # ── 4. 批量写入数据库 ─────────────────────────────────────────
        self.stdout.write('── 步骤 4/4：批量写入数据库 ──')

        # Python 运算期间 MySQL 连接可能已超时，主动关闭让 Django 自动重连
        connection.close()
        self.stdout.write('  → 已重置数据库连接（防止 wait_timeout 断开）')

        # 生长记录
        with transaction.atomic():
            GrowthRecord.objects.bulk_create(growth_list, batch_size=5000)
        self.stdout.write(self.style.SUCCESS(
            f'  ✔ 生长记录：{len(growth_list):,} 条写入完成'
        ))

        # 喂养记录（数量最大，使用 batch_size=5000）
        self.stdout.write(f'  → 正在写入喂养记录 {len(all_feeding):,} 条（batch_size=5000）……')
        with transaction.atomic():
            FeedingRecord.objects.bulk_create(all_feeding, batch_size=5000)
        self.stdout.write(self.style.SUCCESS(
            f'  ✔ 喂养记录：{len(all_feeding):,} 条写入完成'
        ))

        # 疫苗记录
        with transaction.atomic():
            VaccinationHistory.objects.bulk_create(vaccine_list, batch_size=5000)
        self.stdout.write(self.style.SUCCESS(
            f'  ✔ 疫苗记录：{len(vaccine_list):,} 条写入完成'
        ))

        self.stdout.write(self.style.SUCCESS(
            f'\n🎉 全部完成！共写入 '
            f'{len(growth_list):,} 条生长记录、'
            f'{len(all_feeding):,} 条喂养记录、'
            f'{len(vaccine_list):,} 条疫苗记录。'
        ))

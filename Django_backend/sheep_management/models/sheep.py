from django.db import models


class Sheep(models.Model):
    """羊只基本信息表"""
    GENDER_CHOICES = [
        (0, '母'),
        (1, '公'),
    ]
    ear_tag = models.CharField(max_length=50, null=True, blank=True, verbose_name='耳标编号')
    gender = models.IntegerField(choices=GENDER_CHOICES, verbose_name='性别')
    weight = models.FloatField(verbose_name='体重（kg）')
    height = models.FloatField(verbose_name='身高（cm）')
    length = models.FloatField(verbose_name='体长（cm）')
    owner = models.ForeignKey(
        'User',                            # 跨文件引用 User 模型 (用字符串避免循环引用)
        on_delete=models.CASCADE,          # 如果这个养殖户被删了，他的羊也跟着删掉
        limit_choices_to={'role': 1},      # 核心：限制只能选择 role=1 (养殖户) 的用户作为主人
        related_name='sheep_list',
        verbose_name='所属养殖户'
    )
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='价格（元）')
    qr_code = models.ImageField(upload_to='qrcodes/', null=True, blank=True, verbose_name='二维码')
    class Meta:
        db_table = 'sheep'
        verbose_name = '羊只信息'
        verbose_name_plural = '羊只信息'

    def __str__(self):
        return f"羊只#{self.id} - {self.get_gender_display()} - {self.weight}kg"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)



class GrowthRecord(models.Model):
    """生长记录表"""
    sheep = models.ForeignKey(Sheep, on_delete=models.CASCADE, related_name='growth_records', verbose_name='羊只')
    record_date = models.DateField(verbose_name='记录日期')
    weight = models.FloatField(verbose_name='体重（kg）')
    height = models.FloatField(verbose_name='身高（cm）')
    length = models.FloatField(verbose_name='体长（cm）')

    class Meta:
        db_table = 'growth_records'
        verbose_name = '生长记录'
        verbose_name_plural = '生长记录'

    def __str__(self):
        return f"{self.sheep} - {self.record_date}"


class FeedingRecord(models.Model):
    """喂养记录表"""
    sheep = models.ForeignKey(Sheep, on_delete=models.CASCADE, related_name='feeding_records', verbose_name='羊只')
    feed_type = models.CharField(max_length=100, verbose_name='饲料类型')
    start_date = models.DateField(verbose_name='开始日期')
    end_date = models.DateField(null=True, blank=True, verbose_name='结束日期')
    amount = models.FloatField(verbose_name='数量')
    unit = models.CharField(max_length=20, verbose_name='单位')

    class Meta:
        db_table = 'feeding_records'
        verbose_name = '喂养记录'
        verbose_name_plural = '喂养记录'

    def __str__(self):
        return f"{self.sheep} - {self.feed_type} - {self.start_date}"


class VaccineType(models.Model):
    """疫苗种类表"""
    name = models.CharField(max_length=100, unique=True, verbose_name='疫苗名称')
    description = models.TextField(null=True, blank=True, verbose_name='疫苗描述')
    manufacturer = models.CharField(max_length=200, null=True, blank=True, verbose_name='生产厂家')
    validity_days = models.IntegerField(null=True, blank=True, verbose_name='有效期（天）')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        db_table = 'vaccine_types'
        verbose_name = '疫苗种类'
        verbose_name_plural = '疫苗种类'

    def __str__(self):
        return self.name


class VaccinationHistory(models.Model):
    """疫苗接种历史表"""
    vaccine = models.ForeignKey(
        VaccineType,
        on_delete=models.PROTECT,   # 禁止删除仍有接种记录的疫苗种类
        related_name='vaccination_records',
        verbose_name='疫苗种类'
    )
    sheep = models.ForeignKey(Sheep, on_delete=models.CASCADE, related_name='vaccination_records', db_column='sheep_id',
                              verbose_name='羊只')
    vaccination_date = models.DateField(db_column='VaccinationDate', verbose_name='接种日期')
    expiry_date = models.DateField(db_column='ExpiryDate', verbose_name='过期日期')
    dosage = models.FloatField(db_column='Dosage', verbose_name='剂量（ml）')
    administered_by = models.CharField(max_length=100, db_column='AdministeredBy', verbose_name='接种人')
    notes = models.TextField(null=True, blank=True, db_column='Notes', verbose_name='备注')

    class Meta:
        db_table = 'vaccinationhistory'
        verbose_name = '疫苗接种记录'
        verbose_name_plural = '疫苗接种记录'

    def __str__(self):
        return f"{self.sheep} - {self.vaccine} - {self.vaccination_date}"

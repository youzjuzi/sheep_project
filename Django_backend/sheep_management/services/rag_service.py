"""
RAG检索增强生成服务
从数据库检索相关养殖档案数据，作为LLM的上下文
"""
import logging
from django.db.models import Q
from ..models import Sheep, GrowthRecord, FeedingRecord, VaccinationHistory, EnvironmentAlert

logger = logging.getLogger(__name__)


class RAGService:
    """RAG检索增强生成服务"""
    
    @staticmethod
    def retrieve_context(question):
        """
        根据问题检索相关上下文
        :param question: 用户问题
        :return: str 上下文文本
        """
        context_parts = []
        
        # 关键词提取
        keywords = RAGService._extract_keywords(question)
        
        # 根据关键词检索相关数据
        if keywords:
            # 1. 检索羊只数据
            sheep_context = RAGService._retrieve_sheep_data(keywords)
            if sheep_context:
                context_parts.append(sheep_context)
            
            # 2. 检索生长记录
            growth_context = RAGService._retrieve_growth_data(keywords)
            if growth_context:
                context_parts.append(growth_context)
            
            # 3. 检索喂养记录
            feeding_context = RAGService._retrieve_feeding_data(keywords)
            if feeding_context:
                context_parts.append(feeding_context)
            
            # 4. 检索疫苗接种记录
            vaccine_context = RAGService._retrieve_vaccine_data(keywords)
            if vaccine_context:
                context_parts.append(vaccine_context)
            
            # 5. 检索环境预警
            alert_context = RAGService._retrieve_alert_data(keywords)
            if alert_context:
                context_parts.append(alert_context)
        
        # 合并上下文
        if context_parts:
            return '\n\n'.join(context_parts)
        return None
    
    @staticmethod
    def _extract_keywords(question):
        """
        从问题中提取关键词
        :param question: 用户问题
        :return: list 关键词列表
        """
        keywords = []
        
        # 养殖相关关键词
        if any(word in question for word in ['养殖', '饲养', '喂养', '饲料', '草料']):
            keywords.append('feeding')
        
        # 生长相关关键词
        if any(word in question for word in ['生长', '体重', '身高', '体长', '周期', '发育']):
            keywords.append('growth')
        
        # 疫苗相关关键词
        if any(word in question for word in ['疫苗', '接种', '预防', '驱虫', '防疫']):
            keywords.append('vaccine')
        
        # 环境相关关键词
        if any(word in question for word in ['温度', '湿度', '环境', '监控', '预警']):
            keywords.append('environment')
        
        # 健康相关关键词
        if any(word in question for word in ['健康', '疾病', '生病', '治疗']):
            keywords.append('health')
        
        # 滩羊相关关键词
        if any(word in question for word in ['滩羊', '盐池', '特点', '特色']):
            keywords.append('sheep_info')
        
        return keywords
    
    @staticmethod
    def _retrieve_sheep_data(keywords):
        """
        检索羊只基本信息
        """
        if 'sheep_info' not in keywords:
            return None
        
        try:
            # 获取最近添加的羊只信息（示例数据）
            sheep_list = Sheep.objects.all()[:5]
            
            if not sheep_list:
                return None
            
            context = "【羊只基本信息】\n"
            for sheep in sheep_list:
                context += f"- 耳标: {sheep.ear_tag or '无'}, 性别: {sheep.get_gender_display()}, "
                context += f"品种: {sheep.breed}, 体重: {sheep.weight}kg, "
                context += f"身高: {sheep.height}cm, 体长: {sheep.length}cm, "
                context += f"健康状况: {sheep.health_status}\n"
            
            return context
        except Exception as e:
            logger.error(f'检索羊只数据失败: {str(e)}')
            return None
    
    @staticmethod
    def _retrieve_growth_data(keywords):
        """
        检索生长记录
        """
        if 'growth' not in keywords:
            return None
        
        try:
            # 获取最近的生长记录
            growth_records = GrowthRecord.objects.all().order_by('-record_date')[:10]
            
            if not growth_records:
                return None
            
            context = "【生长记录示例】\n"
            for record in growth_records:
                context += f"- 日期: {record.record_date}, "
                context += f"体重: {record.weight}kg, "
                context += f"身高: {record.height}cm, "
                context += f"体长: {record.length}cm\n"
            
            return context
        except Exception as e:
            logger.error(f'检索生长记录失败: {str(e)}')
            return None
    
    @staticmethod
    def _retrieve_feeding_data(keywords):
        """
        检索喂养记录
        """
        if 'feeding' not in keywords:
            return None
        
        try:
            # 获取最近的喂养记录
            feeding_records = FeedingRecord.objects.all().order_by('-start_date')[:10]
            
            if not feeding_records:
                return None
            
            context = "【喂养记录示例】\n"
            for record in feeding_records:
                context += f"- 饲料类型: {record.feed_type}, "
                context += f"开始日期: {record.start_date}, "
                context += f"数量: {record.amount}{record.unit}\n"
            
            return context
        except Exception as e:
            logger.error(f'检索喂养记录失败: {str(e)}')
            return None
    
    @staticmethod
    def _retrieve_vaccine_data(keywords):
        """
        检索疫苗接种记录
        """
        if 'vaccine' not in keywords:
            return None
        
        try:
            # 获取最近的疫苗接种记录
            vaccine_records = VaccinationHistory.objects.all().order_by('-vaccination_date')[:10]
            
            if not vaccine_records:
                return None
            
            context = "【疫苗接种记录示例】\n"
            for record in vaccine_records:
                context += f"- 疫苗: {record.vaccine.name}, "
                context += f"接种日期: {record.vaccination_date}, "
                context += f"过期日期: {record.expiry_date}, "
                context += f"剂量: {record.dosage}ml\n"
            
            return context
        except Exception as e:
            logger.error(f'检索疫苗记录失败: {str(e)}')
            return None
    
    @staticmethod
    def _retrieve_alert_data(keywords):
        """
        检索环境预警记录
        """
        if 'environment' not in keywords:
            return None
        
        try:
            # 获取最近的环境预警
            alerts = EnvironmentAlert.objects.all().order_by('-created_at')[:5]
            
            if not alerts:
                return None
            
            context = "【环境预警记录示例】\n"
            for alert in alerts:
                context += f"- 预警类型: {alert.get_alert_type_display()}, "
                context += f"严重程度: {alert.get_severity_display()}, "
                context += f"创建时间: {alert.created_at}\n"
            
            return context
        except Exception as e:
            logger.error(f'检索预警记录失败: {str(e)}')
            return None
    
    @staticmethod
    def build_rag_prompt(question, context):
        """
        构建RAG提示词
        :param question: 用户问题
        :param context: 检索到的上下文
        :return: str 完整的提示词
        """
        if context:
            return f"""你是一个专业的滩羊养殖和产品咨询助手。

以下是从养殖档案数据库中检索到的相关数据，请基于这些真实数据回答用户的问题：

【检索到的上下文数据】
{context}

【用户问题】
{question}

【回答要求】
1. 请基于上述真实数据回答问题，避免编造信息
2. 如果数据不足以回答，请说明并提供一般性建议
3. 回答要专业、准确、友好
4. 如果问题不在数据范围内，请礼貌说明"""
        else:
            return f"""你是一个专业的滩羊养殖和产品咨询助手。

【用户问题】
{question}

【回答要求】
1. 请用中文回答用户关于滩羊的问题，包括养殖、营养、烹饪等方面
2. 回答要专业、准确、友好
3. 如果问题不在你的知识范围内，请礼貌说明"""

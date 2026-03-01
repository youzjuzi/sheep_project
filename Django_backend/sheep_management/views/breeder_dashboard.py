"""养殖户个人中心视图"""
from django.shortcuts import render, get_object_or_404, redirect
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from ..models import User, Sheep, Order, OrderItem


@login_required
def breeder_dashboard(request):
    """养殖户个人中心"""
    # 获取当前登录用户
    user = request.user
    
    # 获取养殖户的羊只列表
    sheep_list = Sheep.objects.filter(owner=user).order_by('-id')
    
    # 获取养殖户的订单列表
    sheep_ids = sheep_list.values_list('id', flat=True)
    order_items = OrderItem.objects.filter(
        sheep_id__in=sheep_ids
    ).select_related('order__user', 'sheep').order_by('-order__created_at')
    
    # 分组订单
    orders = {}
    for item in order_items:
        if item.order.id not in orders:
            orders[item.order.id] = {
                'order': item.order,
                'items': []
            }
        orders[item.order.id]['items'].append(item)
    
    context = {
        'user': user,
        'sheep_list': sheep_list,
        'orders': list(orders.values()),
        'sheep_count': sheep_list.count(),
        'order_count': len(orders),
    }
    
    return render(request, 'sheep_management/breeder/dashboard.html', context)

@login_required
def breeder_profile(request):
    """养殖户个人资料"""
    import os
    from django.conf import settings
    from django.utils import timezone
    
    # 获取当前登录用户
    user = request.user
    
    if request.method == 'POST':
        user.nickname = request.POST.get('nickname', user.nickname)
        user.mobile = request.POST.get('mobile', user.mobile)
        user.description = request.POST.get('description', '').strip() or None
        
        # 处理头像上传
        if 'avatar' in request.FILES:
            avatar = request.FILES['avatar']
            # 生成唯一文件名
            timestamp = timezone.now().strftime('%Y%m%d%H%M%S')
            ext = os.path.splitext(avatar.name)[1]
            filename = f"avatar_{user.id}_{timestamp}{ext}"
            
            # 确保上传目录存在
            upload_dir = os.path.join(settings.MEDIA_ROOT, 'avatars')
            if not os.path.exists(upload_dir):
                os.makedirs(upload_dir)
            
            # 保存文件
            file_path = os.path.join(upload_dir, filename)
            with open(file_path, 'wb') as f:
                for chunk in avatar.chunks():
                    f.write(chunk)
            
            # 更新头像URL
            user.avatar_url = f"/media/avatars/{filename}"
        
        user.save()
        messages.success(request, '个人资料更新成功！')
        return redirect('breeder_dashboard')
    
    context = {'user': user}
    return render(request, 'sheep_management/breeder/profile.html', context)

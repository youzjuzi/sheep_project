"""智慧牧场视图"""
from django.shortcuts import render
from django.contrib.auth.decorators import login_required


@login_required
def smart_farm(request):
    """智慧牧场 / 环境监控页面"""
    context = {
        'user': request.user,
    }
    return render(request, 'sheep_management/smart_farm.html', context)

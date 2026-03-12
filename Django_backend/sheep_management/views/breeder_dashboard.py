"""Breeder dashboard and profile views."""
import json
import os

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.files.storage import default_storage
from django.http import JsonResponse
from django.shortcuts import redirect, render
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt

from ..models import OrderItem, Sheep


@login_required
def breeder_dashboard(request):
    """Breeder personal center."""
    user = request.user
    sheep_list = Sheep.objects.filter(owner=user).order_by("-id")

    sheep_ids = sheep_list.values_list("id", flat=True)
    order_items = (
        OrderItem.objects.filter(sheep_id__in=sheep_ids)
        .select_related("order__user", "sheep")
        .order_by("-order__created_at")
    )

    orders = {}
    for item in order_items:
        if item.order.id not in orders:
            orders[item.order.id] = {"order": item.order, "items": []}
        orders[item.order.id]["items"].append(item)

    context = {
        "user": user,
        "sheep_list": sheep_list,
        "orders": list(orders.values()),
        "sheep_count": sheep_list.count(),
        "order_count": len(orders),
    }
    return render(request, "sheep_management/breeder/dashboard.html", context)


@login_required
def breeder_profile(request):
    """Breeder profile edit."""
    user = request.user

    if request.method == "POST":
        user.nickname = request.POST.get("nickname", user.nickname)
        user.mobile = request.POST.get("mobile", user.mobile)
        user.description = request.POST.get("description", "").strip() or None

        # Use default storage to keep upload behavior consistent (R2 in current config).
        avatar = request.FILES.get("avatar")
        if avatar:
            timestamp = timezone.now().strftime("%Y%m%d%H%M%S")
            ext = os.path.splitext(avatar.name)[1] or ".jpg"
            filename = f"avatars/avatar_{user.id}_{timestamp}{ext}"
            saved_name = default_storage.save(filename, avatar)
            user.avatar_url = default_storage.url(saved_name)

        user.save()
        messages.success(request, "个人资料更新成功！")
        return redirect("breeder_dashboard")

    return render(request, "sheep_management/breeder/profile.html", {"user": user})


@login_required
def breeder_account(request):
    """Breeder account management page."""
    return render(request, "sheep_management/breeder/account.html", {"user": request.user})


@login_required
@csrf_exempt
def breeder_update_location(request):
    """AJAX save breeder location."""
    if request.method != "POST":
        return JsonResponse({"success": False, "msg": "Method not allowed"}, status=405)

    try:
        data = json.loads(request.body)
        lat = data.get("latitude")
        lng = data.get("longitude")
        user = request.user
        user.latitude = float(lat) if lat is not None else None
        user.longitude = float(lng) if lng is not None else None
        user.save(update_fields=["latitude", "longitude"])
        return JsonResponse({"success": True})
    except Exception as e:
        return JsonResponse({"success": False, "msg": str(e)}, status=400)

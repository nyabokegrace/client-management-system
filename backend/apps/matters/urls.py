from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import MatterViewSet

router = DefaultRouter()
router.register(r'', MatterViewSet, basename='matter')

urlpatterns = [
    path('', include(router.urls)),
]

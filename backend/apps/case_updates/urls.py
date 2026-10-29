from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CaseUpdateViewSet

router = DefaultRouter()
router.register(r'', CaseUpdateViewSet, basename='case-update')

urlpatterns = [
    path('', include(router.urls)),
]

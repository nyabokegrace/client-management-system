from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path('admin/', admin.site.urls),

    # OpenAPI 3.0 Documentation
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),

    # API v1 Versioned Endpoints
    path('api/v1/', include([
        path('', include('apps.accounts.urls')),
        path('clients/', include('apps.clients.urls')),
        path('matters/', include('apps.matters.urls')),
        path('documents/', include('apps.documents.urls')),
        path('case-updates/', include('apps.case_updates.urls')),
        path('hearings/', include('apps.hearings.urls')),
        path('tasks/', include('apps.tasks.urls')),
        path('reports/', include('apps.reports.urls')),
        path('', include('apps.audit.urls')),
    ])),
]

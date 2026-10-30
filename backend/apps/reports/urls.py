from django.urls import path
from .views import DashboardSummaryView, AnalyticsReportsView, ExportReportPDFView

urlpatterns = [
    path('dashboard/', DashboardSummaryView.as_view(), name='report-dashboard'),
    path('analytics/', AnalyticsReportsView.as_view(), name='report-analytics'),
    path('export/', ExportReportPDFView.as_view(), name='report-export-pdf'),
]

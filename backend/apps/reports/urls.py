from django.urls import path
from .views import (
    DashboardSummaryView,
    AnalyticsReportsView,
    ExportReportPDFView,
    ClientReportListView,
    GenerateClientReportView,
    MarkClientReportSentView,
)

urlpatterns = [
    path('dashboard/', DashboardSummaryView.as_view(), name='report-dashboard'),
    path('analytics/', AnalyticsReportsView.as_view(), name='report-analytics'),
    path('export/', ExportReportPDFView.as_view(), name='report-export-pdf'),
    path('client-reports/', ClientReportListView.as_view(), name='client-report-list'),
    path('client-reports/generate/', GenerateClientReportView.as_view(), name='client-report-generate'),
    path('client-reports/<int:pk>/mark-sent/', MarkClientReportSentView.as_view(), name='client-report-mark-sent'),
]

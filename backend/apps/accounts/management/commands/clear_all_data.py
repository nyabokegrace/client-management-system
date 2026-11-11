import os
import shutil
from django.core.management.base import BaseCommand
from django.conf import settings
from django.db import connection
from apps.accounts.models import User
from apps.clients.models import Client
from apps.contacts.models import Contact
from apps.matters.models import Matter
from apps.hearings.models import Hearing
from apps.tasks.models import Task
from apps.case_updates.models import CaseUpdate
from apps.documents.models import Document
from apps.reports.models import ClientReport
from apps.audit.models import AuditLog
from rest_framework.authtoken.models import Token


class Command(BaseCommand):
    help = 'Purges all test and runtime data, leaving the system completely blank and ready for real use'

    def handle(self, *args, **options):
        self.stdout.write('Purging all application data...')

        # 1. Reports and Documents
        ClientReport.objects.all().delete()
        Document.objects.all().delete()

        # Clean physical documents directory
        storage_dir = getattr(settings, 'STORAGE_DIR', None)
        if storage_dir and os.path.exists(storage_dir):
            for item in os.listdir(storage_dir):
                item_path = os.path.join(storage_dir, item)
                if os.path.isdir(item_path):
                    shutil.rmtree(item_path, ignore_errors=True)
                elif os.path.isfile(item_path):
                    try:
                        os.remove(item_path)
                    except OSError:
                        pass
            self.stdout.write(self.style.SUCCESS('Physical document storage cleared.'))

        # 2. Case updates, hearings, tasks
        CaseUpdate.objects.all().delete()
        Hearing.objects.all().delete()
        Task.objects.all().delete()

        # 3. Matters, Contacts, Clients
        Matter.objects.all().delete()
        Contact.objects.all().delete()
        Client.objects.all().delete()

        # 4. Audit trail
        AuditLog.objects.all().delete()

        # 5. Auth Tokens and Users
        Token.objects.all().delete()
        User.objects.all().delete()

        # 6. Reset SQLite auto-increment sequences if on sqlite
        if connection.vendor == 'sqlite':
            with connection.cursor() as cursor:
                cursor.execute("DELETE FROM sqlite_sequence WHERE name IN ('accounts_user', 'clients_client', 'contacts_contact', 'matters_matter', 'hearings_hearing', 'tasks_task', 'case_updates_caseupdate', 'documents_document', 'reports_clientreport', 'audit_auditlog');")

        self.stdout.write(self.style.SUCCESS(
            'All data successfully removed. System is completely blank and ready for first-time use!'
        ))

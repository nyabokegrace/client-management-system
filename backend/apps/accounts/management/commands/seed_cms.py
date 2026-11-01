from django.core.management.base import BaseCommand
from django.db.models import Q
from apps.accounts.models import User, UserRole
from apps.clients.models import Client
from apps.matters.models import Matter
from apps.hearings.models import Hearing
from apps.tasks.models import Task
from apps.case_updates.models import CaseUpdate
from apps.audit.models import AuditLog


class Command(BaseCommand):
    help = 'Ensures core administrator/counsel accounts exist and removes hardcoded demo seed data'

    def handle(self, *args, **options):
        self.stdout.write('Ensuring core accounts for Siwolo P.O Law Advocates...')

        # 1. Core accounts (only set initial password when newly created)
        admin_user, created = User.objects.get_or_create(
            username='admin',
            defaults={
                'email': 'admin@siwololaw.co.ke',
                'first_name': 'Managing',
                'last_name': 'Partner',
                'role': UserRole.ADMIN,
                'is_staff': True,
                'is_superuser': True,
            }
        )
        if created:
            admin_user.set_password('Advocate@2026!')
            admin_user.save()

        senior_advocate, created = User.objects.get_or_create(
            username='siwolo',
            defaults={
                'email': 'p.siwolo@siwololaw.co.ke',
                'first_name': 'Peter O.',
                'last_name': 'Siwolo',
                'role': UserRole.ADVOCATE,
                'phone_number': '+254 722 000111',
            }
        )
        if created:
            senior_advocate.set_password('Advocate@2026!')
            senior_advocate.save()

        # 2. Remove hardcoded demo records if present
        demo_clients = Client.objects.filter(
            Q(national_id='23456789', first_name='Ezekiel', last_name='Kiptoo')
            | Q(organization_name='Apex Logistics Kenya Ltd')
        )
        demo_matter_titles = [
            'Apex Logistics Ltd v. Kenya Ports Authority & Another',
            'Ezekiel Kiptoo — Acquisition of LR No. Nairobi/Block 92/145',
        ]
        demo_matters = Matter.objects.filter(
            Q(title__in=demo_matter_titles) | Q(client__in=demo_clients)
        )

        if demo_matters.exists():
            Hearing.objects.filter(matter__in=demo_matters).delete()
            Task.objects.filter(matter__in=demo_matters).delete()
            CaseUpdate.objects.filter(matter__in=demo_matters).delete()
            demo_matters.delete()

        Task.objects.filter(
            title__in=[
                'Draft Rejoinder to Opposing Submissions',
                'Obtain Certified Search from Lands Registry',
            ]
        ).delete()

        demo_clients.delete()
        User.objects.filter(username__in=['jane.wanjiru', 'clerk.omondi']).delete()
        AuditLog.objects.filter(target_repr='Administrator initial system seed').delete()

        self.stdout.write(self.style.SUCCESS('Core accounts verified and demo seed data cleaned up!'))

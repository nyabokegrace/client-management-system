import os
from django.core.management.base import BaseCommand, CommandError
from django.db.models import Q
from django.conf import settings
from apps.accounts.models import User, UserRole
from apps.clients.models import Client
from apps.matters.models import Matter
from apps.hearings.models import Hearing
from apps.tasks.models import Task
from apps.case_updates.models import CaseUpdate
from apps.audit.models import AuditLog


class Command(BaseCommand):
    help = 'Ensures single administrator account for Siwolo P.O Law Advocates exists and removes demo seed data'

    def handle(self, *args, **options):
        self.stdout.write('Ensuring core administrator account for Siwolo P.O Law Advocates...')

        # Split ADVOCATE_NAME into first and last name
        name_parts = settings.ADVOCATE_NAME.split()
        first_name = " ".join(name_parts[:-1]) if len(name_parts) > 1 else name_parts[0]
        last_name = name_parts[-1] if len(name_parts) > 1 else ''

        admin_password = os.getenv('INITIAL_ADMIN_PASSWORD') or os.getenv('INITIAL_ADVOCATE_PASSWORD')

        admin_user = User.objects.filter(username='admin').first()
        if not admin_user:
            if not admin_password:
                raise CommandError(
                    'INITIAL_ADMIN_PASSWORD (or INITIAL_ADVOCATE_PASSWORD) environment variable is required to seed the administrator account.'
                )
            admin_user = User.objects.create(
                username='admin',
                email=settings.FIRM_EMAIL,
                first_name=first_name,
                last_name=last_name,
                role=UserRole.ADMIN,
                phone_number=settings.FIRM_PHONE,
                is_staff=True,
                is_superuser=True,
            )
            admin_user.set_password(admin_password)
            admin_user.save()
            self.stdout.write(self.style.SUCCESS(f'Created single administrator account: admin ({settings.FIRM_EMAIL})'))
        else:
            self.stdout.write('Administrator account already exists. Existing credentials preserved.')

        # 2. Reassign any records belonging to other users before removing them
        other_users = User.objects.exclude(id=admin_user.id)
        if other_users.exists():
            Matter.objects.filter(assigned_advocate__in=other_users).update(assigned_advocate=admin_user)
            Hearing.objects.filter(assigned_advocate__in=other_users).update(assigned_advocate=admin_user)
            Task.objects.filter(assigned_to__in=other_users).update(assigned_to=admin_user)
            # Remove second 'siwolo' account and any legacy demo users
            other_users.delete()

        # 3. Remove hardcoded demo records if present
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
        AuditLog.objects.filter(target_repr='Administrator initial system seed').delete()

        self.stdout.write(self.style.SUCCESS('Single user verified and demo seed data cleaned up!'))

from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.accounts.models import User, UserRole
from apps.clients.models import Client, ClientType, ClientStatus
from apps.matters.models import Matter, MatterStatus, MatterPriority, MatterType
from apps.hearings.models import Hearing, HearingType, HearingStatus
from apps.tasks.models import Task, TaskPriority, TaskStatus
from apps.case_updates.models import CaseUpdate, UpdateCategory
from apps.audit.models import log_activity, AuditAction, AuditModule


class Command(BaseCommand):
    help = 'Seeds initial users, client records, legal matters and hearings for Siwolo P.O Law Advocates CMS'

    def handle(self, *args, **options):
        self.stdout.write('Seeding initial data for Siwolo P.O Law Advocates...')

        # 1. Users
        admin_user, _ = User.objects.get_or_create(
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
        admin_user.set_password('Advocate@2026!')
        admin_user.save()

        senior_advocate, _ = User.objects.get_or_create(
            username='siwolo',
            defaults={
                'email': 'p.siwolo@siwololaw.co.ke',
                'first_name': 'Peter O.',
                'last_name': 'Siwolo',
                'role': UserRole.ADVOCATE,
                'phone_number': '+254 722 000111',
            }
        )
        senior_advocate.set_password('Advocate@2026!')
        senior_advocate.save()

        associate_advocate, _ = User.objects.get_or_create(
            username='jane.wanjiru',
            defaults={
                'email': 'j.wanjiru@siwololaw.co.ke',
                'first_name': 'Jane',
                'last_name': 'Wanjiru',
                'role': UserRole.ADVOCATE,
                'phone_number': '+254 722 222333',
            }
        )
        associate_advocate.set_password('Advocate@2026!')
        associate_advocate.save()

        clerk, _ = User.objects.get_or_create(
            username='clerk.omondi',
            defaults={
                'email': 'b.omondi@siwololaw.co.ke',
                'first_name': 'Brian',
                'last_name': 'Omondi',
                'role': UserRole.STAFF,
                'phone_number': '+254 733 444555',
            }
        )
        clerk.set_password('Advocate@2026!')
        clerk.save()

        # 2. Clients
        client1, _ = Client.objects.get_or_create(
            first_name='Ezekiel',
            last_name='Kiptoo',
            defaults={
                'client_type': ClientType.INDIVIDUAL,
                'national_id': '23456789',
                'email': 'kiptoo.ezekiel@gmail.com',
                'phone_number': '+254 712 345678',
                'postal_address': 'P.O. Box 45000 Nairobi',
                'physical_address': 'Kilimani, Wood Avenue, Nairobi',
                'assigned_advocate': senior_advocate,
                'status': ClientStatus.ACTIVE,
                'internal_notes': 'Longstanding individual client. Commercial and property transactions.',
                'created_by': admin_user,
            }
        )

        client2, _ = Client.objects.get_or_create(
            organization_name='Apex Logistics Kenya Ltd',
            defaults={
                'client_type': ClientType.ORGANIZATION,
                'registration_number': 'CPR/2018/89452',
                'primary_contact_person': 'Martha Mwangi (Managing Director)',
                'email': 'legal@apexlogistics.co.ke',
                'phone_number': '+254 720 987654',
                'postal_address': 'P.O. Box 10200 Nairobi',
                'physical_address': 'Mombasa Road, Apex Industrial Park, Unit 4B',
                'assigned_advocate': associate_advocate,
                'status': ClientStatus.ACTIVE,
                'internal_notes': 'Corporate retainer client. Freight litigation and contract advisory.',
                'created_by': admin_user,
            }
        )

        # 3. Matters
        matter1, _ = Matter.objects.get_or_create(
            title='Apex Logistics Ltd v. Kenya Ports Authority & Another',
            client=client2,
            defaults={
                'matter_type': MatterType.LITIGATION,
                'status': MatterStatus.ACTIVE,
                'priority': MatterPriority.HIGH,
                'assigned_advocate': senior_advocate,
                'court': 'High Court of Kenya at Mombasa (Admiralty Division)',
                'case_number': 'HCCC/COMM/E045/2026',
                'opposing_party': 'Kenya Ports Authority & Mediterranean Shipping Co.',
                'opposing_advocate': 'Kaplan & Stratton Advocates',
                'description': 'Claim for demurrage losses and breach of bill of lading carriage contracts.',
                'internal_notes': 'Replying affidavit sworn and served. Awaiting ruling on injunction.',
                'created_by': admin_user,
            }
        )

        matter2, _ = Matter.objects.get_or_create(
            title='Ezekiel Kiptoo — Acquisition of LR No. Nairobi/Block 92/145',
            client=client1,
            defaults={
                'matter_type': MatterType.CONVEYANCING,
                'status': MatterStatus.PENDING,
                'priority': MatterPriority.NORMAL,
                'assigned_advocate': associate_advocate,
                'court': 'Lands Registry / Ardhi House Nairobi',
                'case_number': 'LAND/CONV/2026/012',
                'opposing_party': 'Estate of Late J. M. Kariuki',
                'opposing_advocate': 'Njoroge & Partners Advocates',
                'description': 'Conveyancing and title transfer documentation for commercial parcel.',
                'internal_notes': 'Rates clearance certificate received. Awaiting Land Control Board consent.',
                'created_by': senior_advocate,
            }
        )

        # 4. Hearings
        now = timezone.now()
        Hearing.objects.get_or_create(
            matter=matter1,
            hearing_type=HearingType.APPLICATION,
            defaults={
                'hearing_date': now + timedelta(days=5, hours=3),
                'court': 'High Court at Mombasa',
                'location_details': 'Courtroom No. 3 / MS Teams Virtual Court',
                'assigned_advocate': senior_advocate,
                'status': HearingStatus.SCHEDULED,
                'notes': 'Hearing of Notice of Motion for preservation orders. Submissions filed on 14th.',
                'created_by': admin_user,
            }
        )

        Hearing.objects.get_or_create(
            matter=matter1,
            hearing_type=HearingType.MENTION,
            defaults={
                'hearing_date': now + timedelta(days=18, hours=2),
                'court': 'Commercial Court Milimani',
                'location_details': 'Court 8 Commercial Division',
                'assigned_advocate': associate_advocate,
                'status': HearingStatus.SCHEDULED,
                'notes': 'Pre-trial conference mention and compliance check on trial bundles.',
                'created_by': senior_advocate,
            }
        )

        # 5. Tasks
        Task.objects.get_or_create(
            title='Draft Rejoinder to Opposing Submissions',
            matter=matter1,
            defaults={
                'client': client2,
                'assigned_to': associate_advocate,
                'priority': TaskPriority.HIGH,
                'status': TaskStatus.IN_PROGRESS,
                'due_date': now + timedelta(days=3),
                'description': 'Review opposing party authorities and finalize rejoinder submissions for senior counsel review.',
                'created_by': senior_advocate,
            }
        )

        Task.objects.get_or_create(
            title='Obtain Certified Search from Lands Registry',
            matter=matter2,
            defaults={
                'client': client1,
                'assigned_to': clerk,
                'priority': TaskPriority.NORMAL,
                'status': TaskStatus.TODO,
                'due_date': now + timedelta(days=2),
                'description': 'Follow up with Ardhi House Registry for official green card search copy.',
                'created_by': associate_advocate,
            }
        )

        # 6. Case Updates
        CaseUpdate.objects.get_or_create(
            matter=matter1,
            title='Hearing Conducted on Chamber Summons',
            defaults={
                'category': UpdateCategory.COURT_APPEARANCE,
                'description': 'Senior counsel Peter Siwolo appeared before Justice Mbaru. Injunction extended for 14 days pending inter partes hearing.',
                'event_datetime': now - timedelta(days=4),
                'author': senior_advocate,
            }
        )

        CaseUpdate.objects.get_or_create(
            matter=matter1,
            title='Formal Pleadings & Evidentiary Bundle Filed',
            defaults={
                'category': UpdateCategory.FILING,
                'description': 'Plaint, verifying affidavit and list of 12 documentary exhibits electronically filed via Judiciary e-filing portal.',
                'event_datetime': now - timedelta(days=10),
                'author': clerk,
            }
        )

        # 7. Audit log
        log_activity(
            actor=admin_user,
            action=AuditAction.LOGIN,
            module=AuditModule.AUTH,
            target_repr='Administrator initial system seed'
        )

        self.stdout.write(self.style.SUCCESS('Successfully seeded initial data for Siwolo CMS!'))

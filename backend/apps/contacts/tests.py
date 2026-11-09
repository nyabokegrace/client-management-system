from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from apps.accounts.models import User, UserRole
from apps.clients.models import Client
from apps.matters.models import Matter
from apps.contacts.models import Contact, ContactType
from apps.audit.models import AuditLog, AuditAction


class ContactManagementTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.advocate = User.objects.create_user(
            username='adv_siwolo',
            email='advocate@siwoloadvocates.com',
            password='Password123!',
            first_name='Peter',
            last_name='Siwolo',
            role=UserRole.ADVOCATE
        )
        self.admin = User.objects.create_superuser(
            username='admin_siwolo',
            email='admin@siwoloadvocates.com',
            password='Password123!',
            first_name='Peter',
            last_name='Siwolo',
            role=UserRole.ADMIN
        )
        self.client_record = Client.objects.create(
            first_name='James',
            last_name='Kamau',
            phone_number='+254712000333',
            created_by=self.advocate
        )
        self.client.force_authenticate(user=self.advocate)

    def test_create_and_update_contact(self):
        url = reverse('contact-list')
        data = {
            'name': 'Ochieng & Partners Advocates',
            'contact_type': ContactType.LAW_FIRM,
            'firm_name': 'Ochieng & Partners',
            'phone': '+254722999888',
            'email': 'info@ochienglaw.co.ke',
            'address': 'Mayfair Suites, Parklands, Nairobi',
            'notes': 'Opposing counsel in commercial arbitration'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        contact_id = response.data['id']
        self.assertEqual(response.data['name'], 'Ochieng & Partners Advocates')

        # Verify audit log
        audit = AuditLog.objects.filter(action=AuditAction.CREATE, module='CONTACT', target_id=str(contact_id)).first()
        self.assertIsNotNone(audit)

        # Update contact
        patch_url = reverse('contact-detail', kwargs={'pk': contact_id})
        patch_resp = self.client.patch(patch_url, {'phone': '+254733111222'}, format='json')
        self.assertEqual(patch_resp.status_code, status.HTTP_200_OK)

        # Verify update audit log
        update_audit = AuditLog.objects.filter(action=AuditAction.UPDATE, module='CONTACT', target_id=str(contact_id)).first()
        self.assertIsNotNone(update_audit)
        self.assertIn('phone', update_audit.details.get('changes', {}))

    def test_delete_contact_blocked_when_linked_to_matter(self):
        contact = Contact.objects.create(
            name='Senior Counsel Ahmed',
            contact_type=ContactType.ADVOCATE,
            firm_name='Ahmed & Co Advocates',
            phone='+254722000999',
            created_by=self.advocate
        )
        matter = Matter.objects.create(
            title='Injunction Application against Bank',
            client=self.client_record,
            location='Nairobi',
            opposing_contact=contact,
            created_by=self.advocate
        )

        # Admin attempts to delete contact
        self.client.force_authenticate(user=self.admin)
        url = reverse('contact-detail', kwargs={'pk': contact.pk})
        del_resp = self.client.delete(url)
        self.assertEqual(del_resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('cannot be deleted', del_resp.data.get('error', ''))
        self.assertTrue(Contact.objects.filter(pk=contact.pk).exists())

        # Unlink from matter, then delete succeeds
        matter.opposing_contact = None
        matter.save()

        del_resp2 = self.client.delete(url)
        self.assertEqual(del_resp2.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Contact.objects.filter(pk=contact.pk).exists())

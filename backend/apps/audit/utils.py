from decimal import Decimal
from datetime import date, datetime
from apps.audit.models import log_activity, AuditAction, AuditModule

EXCLUDED_FIELDS = {'id', 'created_at', 'updated_at', 'password', 'token'}


def serialize_value(val):
    if val is None:
        return None
    if isinstance(val, (int, float, bool, str)):
        return val
    if isinstance(val, (date, datetime)):
        return val.isoformat()
    if isinstance(val, Decimal):
        return str(val)
    if hasattr(val, 'pk'):
        # For ForeignKey models, use display string or reference
        return getattr(
            val,
            'display_name',
            getattr(
                val,
                'title',
                getattr(
                    val,
                    'matter_reference',
                    getattr(val, 'client_reference', getattr(val, 'full_name', str(val)))
                )
            )
        )
    return str(val)


def get_field_dict(instance):
    data = {}
    for f in instance._meta.fields:
        if f.name in EXCLUDED_FIELDS:
            continue
        try:
            val = getattr(instance, f.name)
            data[f.name] = serialize_value(val)
        except Exception:
            pass
    return data


def record_create_audit(actor, module, instance, target_repr=None):
    ref = getattr(instance, 'matter_reference', getattr(instance, 'client_reference', ''))
    name = getattr(
        instance,
        'title',
        getattr(instance, 'display_name', getattr(instance, 'original_filename', str(instance)))
    )
    if not target_repr:
        target_repr = f"{ref} - {name}" if ref else name

    current_fields = get_field_dict(instance)
    changes = {
        k: {'old': None, 'new': v}
        for k, v in current_fields.items()
        if v is not None and v != ''
    }

    details = {
        'name': str(name),
        'reference': str(ref),
        'changes': changes,
    }
    log_activity(
        actor=actor,
        action=AuditAction.CREATE,
        module=module,
        target_id=str(instance.id),
        target_repr=str(target_repr)[:255],
        details=details,
    )


def record_update_audit(actor, module, old_instance, new_instance, target_repr=None):
    ref = getattr(new_instance, 'matter_reference', getattr(new_instance, 'client_reference', ''))
    name = getattr(
        new_instance,
        'title',
        getattr(new_instance, 'display_name', getattr(new_instance, 'original_filename', str(new_instance)))
    )
    if not target_repr:
        target_repr = f"{ref} - {name}" if ref else name

    old_fields = get_field_dict(old_instance)
    new_fields = get_field_dict(new_instance)

    changes = {}
    for k in set(old_fields.keys()).union(new_fields.keys()):
        old_val = old_fields.get(k)
        new_val = new_fields.get(k)
        if old_val != new_val:
            changes[k] = {'old': old_val, 'new': new_val}

    details = {
        'name': str(name),
        'reference': str(ref),
        'changes': changes,
    }
    log_activity(
        actor=actor,
        action=AuditAction.UPDATE,
        module=module,
        target_id=str(new_instance.id),
        target_repr=str(target_repr)[:255],
        details=details,
    )


def record_delete_audit(actor, module, instance, target_repr=None):
    ref = getattr(instance, 'matter_reference', getattr(instance, 'client_reference', ''))
    name = getattr(
        instance,
        'title',
        getattr(instance, 'display_name', getattr(instance, 'original_filename', str(instance)))
    )
    if not target_repr:
        target_repr = f"{ref} - {name}" if ref else name

    details = {
        'name': str(name),
        'reference': str(ref),
    }
    log_activity(
        actor=actor,
        action=AuditAction.DELETE,
        module=module,
        target_id=str(instance.id),
        target_repr=str(target_repr)[:255],
        details=details,
    )

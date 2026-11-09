import os

# =============================================================================
# Firm & Principal Advocate Profile Settings (Single Source of Truth)
# =============================================================================
# TODO: Advocate's full name to be confirmed by Grace
DEFAULT_ADVOCATE_NAME = 'Peter O. Siwolo'

FIRM_NAME = os.getenv('FIRM_NAME', 'Siwolo P.O Law Advocates')
ADVOCATE_NAME = os.getenv('ADVOCATE_NAME', DEFAULT_ADVOCATE_NAME)
ADVOCATE_TITLE = os.getenv('ADVOCATE_TITLE', 'Principal Advocate and Founder')
FIRM_PHONE = os.getenv('FIRM_PHONE', '+254792300520')
FIRM_EMAIL = os.getenv('FIRM_EMAIL', 'info@siwoloadvocates.com')
FIRM_ADDRESS = os.getenv('FIRM_ADDRESS', '')  # Blank-safe: if empty, omit it


def get_firm_details():
    """
    Returns firm contact and advocate details.
    Blank-safe: if address is empty or whitespace, it is omitted.
    """
    details = {
        'firm_name': FIRM_NAME,
        'advocate_name': ADVOCATE_NAME,
        'advocate_title': ADVOCATE_TITLE,
        'firm_phone': FIRM_PHONE,
        'firm_email': FIRM_EMAIL,
    }
    if FIRM_ADDRESS and FIRM_ADDRESS.strip():
        details['firm_address'] = FIRM_ADDRESS.strip()
    return details

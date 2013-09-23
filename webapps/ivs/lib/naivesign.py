"""Naive implementation for creating signed values.

Caveats:

- It does not attempt to prevent replay attacks.
- It is susceptible to a timing attack for signature verification."""

import base64
import hmac
import hashlib


def create_signed_value(key, val):
    """Returns a signed value that can be decoded using decode_signed_value.

key - is a secret.
val - value to be signed.
"""
    val = base64.b64encode(str(val))
    signature = _sign(key, val)
    return b'|'.join([val, signature])


def decode_signed_value(key, signed_val):
    """Decodes the value signed with encode_signed_value.

key - is a secret.
val - value to be signed.
"""
    try:
        (val, signature) = str(signed_val).split(b'|')
    except ValueError:
        return None
    if signature != _sign(key, val):
        return None
    return base64.b64decode(val)


def _sign(key, val):
    return hmac.new(key, msg=val, digestmod=hashlib.sha1).hexdigest()
